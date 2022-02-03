const fetch = require('isomorphic-unfetch')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const { normalize } = require('@geolonia/normalize-japanese-addresses')
const fs = require('fs')
const path = require('path')

const consolidationURL = "https://www.soumu.go.jp/gapei/gapei_h11iko.html"

const separateRuby = (str) => {
	const normalized = str.replace(/（/g, '(').replace(/）/g, ')') 
	const match = normalized.match(/^(.+)(\((.+)\))$/)
	if(!match) return [null, null]
	return [match[1].trim(), match[3].trim() || null]
}

const scrapeConsolidation = async () => {
	const resp = await fetch(consolidationURL)
	const htmlBuffer = await resp.buffer()
	const $ = cheerio.load(iconv.decode(htmlBuffer, 'shift-jis'))
	const table = $('table')
	if(table.length !== 1) {
		throw new Error('Unexpected webpage update.')
	}

	const data = []

	const headers = table.find('tr:nth-child(1) th')
	const headerItems = []
	for (const header of headers) {
		const headerItem = header.children
			.map(child => child.data || '')
			.map(text => text.trim().replace(/\n/g, ''))
			.join('')
		headerItems.push(headerItem)
	}	

	const rows = table.find('tr:not(:nth-child(1))')

	for (const row of rows) {
		const columns = $(row).find('td')
		const colItems = {}
		for (let index = 0; index < columns.length; index++) {
			const col = columns[index];
			colItems[headerItems[index]] = col.children
				.map(child => child.data || '')
				.map(text => text.trim().replace(/\n/g, ''))
				.join('')
			
		}
		data.push(colItems)
	}
	return data
}

const main = async () => {

	const consolidationRecords = await scrapeConsolidation()

	const cities = {}
	let item = null
	while (item = consolidationRecords.pop()) {
		let {
			合併年月日: date,
			都道府県: pref,
			新市町村名: newCityWithRuby,
			合併関係市町村: relatedCitiesStr,
			合併形態: consolidationType
		} = item

		if(pref === '岐阜県（、長野県）') {
			// TODO: 市区町村をまたぐ編入は過去にこの一件しかない。
			// 例外として処理する
			pref = '岐阜県'
		}
		const [newCity, 新市町村名読み仮名] = separateRuby(newCityWithRuby)
		const norm = await normalize(`${pref}${newCity}`, { level: 2 })
		// TODO: 政令指定都市の時に抜けちゃう
		const key = norm.city && `${pref}${norm.city}` // 郡名を補完

		let relatedCities = relatedCitiesStr.split('、').filter(x => !!x)

		// 同郡、みたいに書かれているのでこれを補完
		let gunCursor = ''
		for (let index = 0; index < relatedCities.length; index++) {
			const cityName = relatedCities[index];
			// NOTE: 郡名の読み仮名が付加されていないが、とりあえずこのままにしておく
			const kanjiMatch = cityName.match(/^(.+郡)/)
			if (kanjiMatch) {
				if (kanjiMatch[0] === '同郡' || kanjiMatch[0] === '同（どう）郡') {
					if(gunCursor === '') throw new Error('Unexpected error')
					cityName.startsWith() && console.log(cityName)
					relatedCities[index] = cityName
						.replace('同郡', gunCursor)
						.replace('同（どう）郡', gunCursor)
						.replace(/ （.+(）)/g, '')
				} else {
					gunCursor = kanjiMatch[0]
				}
			}
		}

		if(consolidationType === '編入' || consolidationType === '新設') {
			const prevItems = relatedCities.map(cityWithRuby => {
				const [city, ruby] = separateRuby(cityWithRuby)
				const subKey = `${pref}${city}`
				// 市区町村を作成
				if(!cities[subKey]) {
					cities[subKey] = {
						pref,
						city,
						prev: [],
						next: [{ pref, city: norm.city, date, consolidationType }],
					}
				}
				return { pref, city, date, consolidationType }
			})
			// TODO: 政令指定都市の時にvalueが作れていない。
			cities[key] && cities[key].prev.push(...prevItems)
		} else {
			throw new Error(`Unknown consolidation type: ${consolidationType}`)
		}
	}

	const all = {}
	const basePath = path.resolve(__dirname, '..', 'api', 'ja')
	for (const key in cities) {
		const city = cities[key]
		if(city.city === null) continue // TODO: 多分県境跨いで編入した時 
		all[city.pref] ? all[city.pref].push(city.city) : all[city.pref] = [city.city]
		const dir = path.resolve(basePath, city.pref)
		fs.mkdirSync(dir, { recursive: true })
		fs.writeFileSync(path.resolve(dir, `${city.city}.json`), JSON.stringify(city))
	}
	fs.writeFileSync(`${basePath}.json`, JSON.stringify(all))

}

main()

