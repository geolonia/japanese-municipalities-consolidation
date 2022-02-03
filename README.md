# 日本の市区町村 新設・編入 API

旧市区町村名を最新の市区町村名に変換するための API です。

## API

`GET /{都道府県名}/{旧市区町村名}.json`

```json
{
	"pref": "沖縄県",
	"city": "石川市",
	"prev": [],
	"next": [
		{
			"pref": "沖縄県",
			"city": "うるま市",
			"date": "平成17年4月1日",
			"consolidationType": "新設"
		}
		]
	}
```
