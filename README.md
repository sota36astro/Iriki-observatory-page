# Iriki Observatory Weather Page

入来観測所向けの観測補助ページです。全天カメラ画像、夜間情報、気象予報を1ページで確認できるようにしています。

## 内容

- 全天カメラ画像の表示
- 日没、日の出、天文薄明、月齢の表示
- MET Norway Locationforecast API による24時間予報グラフ
- ドーム内外の温度・湿度表示枠

## ファイル構成

- `observatory.html`: ページ本体
- `observatory.css`: 画面レイアウトとスタイル
- `observatory-camera.js`: カメラ画像の更新処理
- `observatory-night.js`: 夜間情報の計算と表示
- `observatory-weather.js`: 気象予報の取得と表示
- `images/`: 表示用画像
- `old_260512/`: 旧実装の保管

## 使い方

`observatory.html` をブラウザで開くと表示できます。GitHub Pages などの静的ホスティングにも配置できます。

## データ出典

- 天気予報: [MET Norway Locationforecast API](https://api.met.no/)
- 日の出・日の入り計算の参考: [日本と世界の日の出日の入り時間](https://www.motohasi.net/SunriseSunset/WorldSun.php)

## メモ

現在、ドーム内カメラと温度・湿度センサーの値は準備中です。接続先が決まり次第、HTML または JavaScript 側で差し替えます。
