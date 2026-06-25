# Iriki Observatory Weather Page

入来観測所向けの観測補助ページです。全天カメラ画像、夜間情報、ドーム温湿度、気象予報を1ページで確認できるようにしています。

## 内容

- 全天カメラ画像の表示と5分ごとの再読み込み
- 日没、翌朝日の出、天文薄明、月齢の表示
- `latest.json` によるテスト温度・湿度の表示と1分ごとの再読み込み
- `bme280_plot.png` による温度・湿度推移グラフの表示（`observatory2.html`）
- MET Norway Locationforecast API による24時間予報グラフ
- ドーム内カメラ、ドーム外温湿度の表示枠

## ファイル構成

- `observatory.html`: 基本ページ。全天カメラ、夜間情報、温湿度最新値、24時間予報を表示
- `observatory2.html`: `observatory.html` に温度・湿度推移グラフを追加した版
- `observatory.css`: 画面レイアウトとスタイル
- `observatory-camera.js`: カメラ画像の更新処理
- `observatory-night.js`: 夜間情報の計算と表示
- `observatory-dome.js`: `latest.json` から温湿度最新値を取得して表示
- `observatory-dome-plot.js`: `bme280_plot.png` のキャッシュを避けて定期再読み込み
- `observatory-weather.js`: 気象予報の取得と表示
- `latest.json`: BME280 センサー最新値の JSON
- `bme280_plot.png`: 温度・湿度推移グラフ画像
- `images/`: 表示用画像
- `old_260512/`: 旧実装の保管

## 使い方

静的ホスティング、またはローカルのHTTPサーバーで配信して表示します。

```sh
python3 -m http.server 8000
```

起動後、以下をブラウザで開きます。

- `http://localhost:8000/observatory.html`
- `http://localhost:8000/observatory2.html`

`latest.json` や MET Norway API は JavaScript の `fetch` で取得します。ブラウザでHTMLファイルを直接開いた場合、環境によっては温湿度や天気予報の取得が失敗します。

## データ更新

- 全天カメラ画像: `observatory-camera.js` が5分ごとに画像URLへ時刻パラメータを付けて再読み込み
- 温湿度最新値: `observatory-dome.js` が `latest.json` を1分ごとに再取得
- 温湿度推移グラフ: `observatory-dome-plot.js` が `bme280_plot.png` を1分ごとに再読み込み
- 天気予報: `observatory-weather.js` が MET Norway Locationforecast API を1時間ごとに再取得

`latest.json` は以下の形式を想定しています。

```json
{
  "timestamp": "2026-06-01 16:34:00",
  "temperature_C": 23.85,
  "humidity_percent": 46.86,
  "pressure_hPa": 1010.86
}
```

## データ出典・計算

- 天気予報: [MET Norway Locationforecast API](https://api.met.no/)
- 日の出・日の入り計算の参考: [日本と世界の日の出日の入り時間](https://www.motohasi.net/SunriseSunset/WorldSun.php)
- 夜間情報: 入来観測所付近の緯度経度からブラウザ上で計算。午前9時より前は前日の観測夜として扱います。

## メモ

現在、ドーム内カメラとドーム外温湿度はプレースホルダーです。接続先が決まり次第、HTML または JavaScript 側で差し替えます。
