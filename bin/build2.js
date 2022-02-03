const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')
const { parse } = require('csv-parse/sync')


const parseReason = (reasonTexts, record) => {
	const date = record[6]
	let processed = null
	let reasons = reasonTexts.split('\r\n').map(text => text.replace(/（/g, '(').replace(/）/g, ')'))
	let match
	const results = []
	for (const reasonText of reasons) {
		if (match = reasonText.match(/^((.+[市区町村]\([0-9]+\))、)+(.+[市区町村]\([0-9]+\))が合併し、(.+[市区町村](\([0-9]+\))?)を新設$/g)) {
			// 合併・新設パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[町村]\([0-9]+\))が(.+[市町]\([0-9]+\))に(市|町)制施行$/g)) {
			// 町市政移行パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[町]\([0-9]+\))が(.+[市])に市制施行し、(.+[市]\([0-9]+\))に名称変更$/)) {
			// 市政施行・名称変更パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[市区町村]\([0-9]+\))が(.+[市区町村](\([0-9]+\))?)に名称変更$/g)) {
			// 名称変更パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(((.+[市区町村]\([0-9]+\))、)+)?(.+[市区町村]\([0-9]+\))が(.+[市区町村](\([0-9]+\))?)に編入$/g)) {
			// 編入パターン
			processed = processed === null ? true : processed && true
		} else if (
			date === '2006-03-01' &&
			reasonText === '中道町(19326)と上九一色村(19341)大字梯及び古関が甲府市(19201)に編入'
		) {
			// 特殊な編入パターン1
			processed = processed === null ? true : processed && true
		} else if (
			date === '2006-03-01' &&
			reasonText === '上九一色村(19341)大字梯及び古関が甲府市(19201)に編入し、大字精進、本栖及び富士ヶ嶺が富士河口湖町(19430)に編入'
		) {
			// 特殊な編入パターン2
			processed = processed === null ? true : processed && true
			
		} else if (match = reasonText.match(/^(.+(郡|支庁)\([0-9]+\))の廃止$/g)) {
			// 廃止パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[市]\([0-9]+\))の(.+[市]\([0-9]+\))への(政令指定都市)(施行|移行)$/)) {
			// 政令指定都市施行パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[市]\([0-9]+\))が(中核市|特例市|特例市から中核市)に移行$/)) {
			// 中核市・特例市移行パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[町]\(((.+)、)?[0-9]+\))が(.+[町])(\(.+\))に名称変更$/)) {
			// 町の名称変更パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[村]\(((.+)、)?[0-9]+\))が(.+[村])(\(.+\))に名称変更し、(.+[町]\((.+、)?[0-9]+\))に町制施行$/)) {
			// 村の名称変更・町制施行パターン
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+(郡|支庁).+[村町]\([0-9]+\))が(.+(郡|支庁).+[村町])(\(.+\))に(郡の)?区域変更$/)) {
			// 支庁・郡の区域変更
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^((.+[区]\([0-9]+\))、)*(.+[区](\([0-9]+\))?)の新設$/)) {
			// 区の新設
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^((.+[区]\([0-9]+\))から分離し、)?((.+[区]\([0-9]+\))、)*(.+[区](\([0-9]+\))?)を新設$/)) {
			// 区の分離・新設
			processed = processed === null ? true : processed && true
		} else if (match = reasonText.match(/^(.+[郡](\([0-9]+\))?)の新設$/)) {
			// 郡の新設
			processed = processed === null ? true : processed && true
		} else {
			processed = processed === null ? false : processed && false
			console.log({reasonText, date})
		}		
	}


	return { processed, reasons }
}

const main = async () => {
	const csvBuffer = fs.readFileSync(path.resolve(__dirname, '..', 'data', 'haichibangou.csv'))
	const csv = iconv.decode(csvBuffer, 'shift-jis')
	const records = parse(csv)

	const headers = records.shift()
	const atomicRecords = []
	for (const record of records) {
		const data = record.reduce((prev, item, index) => {
			const key = headers[index]
			if(key === '改正事由') {
				const { processed, reasons } = parseReason(item, record)
				prev[key] = reasons
				prev['__processed'] = processed
			} else {
				prev[key] = item
			}
			return prev
		}, {})
		atomicRecords.push(data)
	}
	const processedCount = atomicRecords.filter(r => r.__processed).length
	console.log(`${processedCount}/${atomicRecords.length}`)
}

main()
