# Iriki Observatory Weather Page

入来観測所向けの観測補助ページです。全天カメラ画像、夜間情報、温度・湿度、気象予報、観測装置の運用温度を1ページで確認できるようにしています。

## 内容

- 全天カメラ画像の表示と5分ごとの再読み込み
- 日没、翌朝日の出、天文薄明、月齢の表示
- `latest.json` によるテスト温度・湿度の表示と1分ごとの再読み込み
- `bme280_plot.png` による温度・湿度推移グラフの表示（`observatory2.html`）
- MET Norway Locationforecast API による24時間予報グラフ
- ドーム内カメラ、ドーム外温湿度の表示枠
- `observatory4.html` のタブによる観測所ステータス／装置温度チェックの切り替え
- kSIRIUS、OPTCAM、KOspecの運用温度グラフ表示
- kSIRIUSの最新温度、ヒーター値、真空度、データ更新時刻の表示

## ファイル構成

- `observatory.html`: 基本ページ。全天カメラ、夜間情報、温湿度最新値、24時間予報を表示
- `observatory2.html`: `observatory.html` に温度・湿度推移グラフを追加した版
- `observatory3.html`: 観測装置の搭載状況などを追加した版
- `observatory4.html`: 観測所ステータスと装置温度チェックをタブで切り替える版
- `observatory5.html`: `observatory4.html` を元に、日本時間の時計を見出しの右に追加した試し用ページ
- `observatory-clock.js` / `observatory-clock.css`: 時計の毎秒更新と試し用ページの配置
- `observatory.css`: 画面レイアウトとスタイル
- `observatory-camera.js`: カメラ画像の取得、EXIF回転の補正、全天画像の切り出し、8方位と撮影情報の描画
- `process_sky_camera.py`: 同じ加工を配信側や手元で行うための任意のツール（Pillowを使用）
- `observatory-night.js`: 夜間情報の計算と表示
- `observatory-dome.js`: `latest.json` から温湿度最新値を取得して表示
- `observatory-dome-plot.js`: `bme280_plot.png` のキャッシュを避けて定期再読み込み
- `observatory-weather.js`: 気象予報の取得と表示
- `observatory-tabs.js`: `observatory4.html` のタブ切り替えと装置グラフ画像の再読み込み
- `observatory-ksirius.js`: `../ksirius/day.dat` の最新行を取得し、kSIRIUSの現在値を表示
- `latest.json`: BME280 センサー最新値の JSON
- `latest_outside.json`: 別センサーによる外気温度・湿度の最新値（配信側で用意）
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

`observatory4.html` は親ディレクトリにある装置データを参照するため、ローカル確認時はこのディレクトリの1階層上を配信ルートにします。

```sh
cd ..
python3 -m http.server 8000
```

- `http://localhost:8000/observatory_page/observatory4.html`
- `http://localhost:8000/observatory_page/observatory5.html`（時計の試し用ページ）

試し用ページの時計は、NICT公式の日本標準時表示ページが使用するHTTPSのJSON時刻サービスから表示直後と5分ごとに同期し、日本時間（Asia/Tokyo）で `hh:mm:ss` 形式に表示します。NICTへ毎秒問い合わせず、同期した時刻を `performance.now()` の経過時間で進めて表示だけを毎秒更新します。往復通信時間の半分を使って通信遅延を概算補正します。タブを再表示した場合も再同期しますが、取得間隔は最低1分を空けます。3つの公式ページ掲載サーバを順に使用します。

初回同期に失敗した場合は `--:--:--` と「NICT時刻未取得」を表示します。再同期に失敗した場合は前回のNICT同期時刻から表示を継続し、「再同期失敗」を表示します。端末時刻へ自動で切り替えません。通常のページは時計を読み込まず、試し用HTMLにだけ追加しています。取得先の出典: [NICT日本標準時表示ページ](https://www.nict.go.jp/JST/JST5.html)。

`latest.json` や MET Norway API は JavaScript の `fetch` で取得します。ブラウザでHTMLファイルを直接開いた場合、環境によっては温湿度や天気予報の取得が失敗します。

## データ更新

- 全天カメラ画像: `observatory-camera.js` が表示直後と5分ごとに元画像を取得し、ブラウザ内で加工して表示
- 温湿度最新値: `observatory-dome.js` が `latest.json` を1分ごとに再取得
- 外気温湿度: `observatory-dome.js` が `latest_outside.json` を1分ごとに独立して再取得
- 温湿度推移グラフ: `observatory-dome-plot.js` が `bme280_plot.png` を1分ごとに再読み込み
- 天気予報: `observatory-weather.js` が MET Norway Locationforecast API を1時間ごとに再取得
- 装置温度グラフ: 装置温度タブを開くたびに `observatory-tabs.js` が画像を再読み込み
- kSIRIUS現在値: `observatory-ksirius.js` が `../ksirius/day.dat` をページ表示直後と5分ごとに再取得

装置温度グラフは4:3（現在は640×480 pxを想定）で、以下の相対パスから読み込みます。

- kSIRIUS: `../ksirius/day.png`
- OPTCAM: `../optcam/day.png`
- KOspec: `../kospec/day.png`

### observatory5.html の搭載状態とグラフ切り替え

「利用可能な観測装置」の各 `.instrument-slot` 内にある状態ラベルを、手動で `搭載中` または `未搭載` に変更してください。ページを再読み込みすると、`observatory-tabs.js` がラベルに合わせて搭載欄の色・説明とグラフを切り替えます。クラスや画像の `src` を編集する必要はありません。

- `搭載中`: その装置の温度グラフを表示
- `未搭載`: `makeplot/stopped.png` の「停止中」画像を表示

搭載欄と画像は同じ `data-instrument` 値（`ksirius`、`optcam`、`kops`）で対応付けています。HTML・`observatory-tabs.js`・`makeplot/stopped.png` を一緒に公開してください。温度の数値・測定日時の取得は従来どおり継続します。

### observatory5.html のOPTCAM・KOPS最新温度

`observatory-instrument-temperatures.js` が装置名の横に測定温度（℃、小数1桁）を表示します。HTMLとこのJSを一緒に公開してください。ページ表示直後、1分ごと、および装置温度タブを開いたときに再取得します。

配信側で以下のJSONファイルを作成し、グラフと同じ `plot/` ディレクトリへ転送してください。パスは `observatory5.html` からの相対パスで、大文字・小文字を区別します。

| 装置 | JSONの配置先 |
| --- | --- |
| OPTCAM | `plot/OPTCAM_latest.json` |
| KOPS | `plot/KOspec_latest.json` |

OPTCAMは次の形式で、`g`・`i` それぞれの実測温度を表示します（以下は形式説明用の例で、実測値ではありません）。

```json
{
  "timestamp": "2026-10-31T19:08:02",
  "g": {
    "setting_temperature": 0.0,
    "measured_temperature": 0.0
  },
  "i": {
    "setting_temperature": 0.0,
    "measured_temperature": -0.0
  }
}
```

KOPSは次の形式です。

```json
{
  "timestamp": "2026-07-23T17:50:22",
  "setting_temperature": 0.0,
  "measured_temperature": 0.0
}
```

`measured_temperature` に最新の実測温度（℃）を数値で入れてください。`setting_temperature` は設定温度で、現在の表示には使用しません。`timestamp` は取得時刻ではなく、その温度の測定日時を文字列で入れます。ページにはタイムゾーンの変換をせずそのまま表示します。KOspecの `makeplot/log_260720` と同じログ形式では、1・2列目が測定日・時刻、3列目が設定温度、4列目が実測温度です。

ファイルが未配置の場合や取得・形式検証に失敗した場合は `-- ℃` と「取得失敗」を表示します。古い測定値かどうかは、併記する測定日時で確認してください。実測データと誤認しないよう、サンプルJSONは公開用のパスに同梱していません。

### kSIRIUS day.dat

`../ksirius/day.dat` は空行とコメント行を除いた最終行を最新値として使用します。日付、時刻に続いて18個の数値列がある形式を想定しています。

```text
2026/07/22 22:14:39 304.7 045.49 ... 129.96 089.99 065.00 077.52 0638 0620 1365 0000 6.5000E-04
```

表示対象の列位置は `observatory-ksirius.js` の `METRIC_COLUMN_INDEXES` で定義しています。DomeはKに加えて、`K - 273.15` で計算した摂氏温度も表示します。ページ全体を再読み込みせず、数値とLast Updateだけを更新します。

### 全天カメラ画像の表示と運用

通常運用ではPythonの実行は不要です。4つのHTML、`observatory.css`、`observatory-camera.js` を公開サーバーに反映すると、JavaScriptが表示直後と5分ごとに元画像を取得し、ブラウザ内のCanvasで加工して表示します。

元画像の場所はHTMLの `#sky-camera-img` の `data-source="../capt0000.jpg"` で指定しています。元画像の公開場所が変わった場合はこの値を変更してください。HTTPサーバー経由でページと画像を配信します。別ドメインの画像を使う場合は、画像の配信側でCORSを許可する必要があります。

取得した同じJPEGから撮影時刻・露光時間を読み出し、EXIF Orientationを1へ補正してからデコードします。その後、中央の正方形を切り出し、余白に8方位・撮影時刻・露光時間を描画した1200×1200の画像へ置き換えます。ページ側では追加の切り取りを行いません。表示画像はブラウザ内で生成され、サーバー上に保存されません。

取得や加工に失敗した場合は前回の表示画像を残し、ステータスに「更新失敗（前回画像）」と表示します。EXIFがない場合、撮影情報は `unknown` になります。撮影時刻はカメラの記録をそのまま使い、ページの取得時刻で代用しません。

`images/sky-camera.jpg` はJavaScriptの加工が完了する前に表示する初期画像です。リポジトリにある画像は `images/20261002132003.jpg` から生成した確認用画像であり、取得に失敗した場合はこれが残ることがあります。これも公開してください。

### Pythonで処理済み画像を作る場合（任意）

Python 3、Pillow、DejaVu SansのTrueTypeフォントを使用します。フォントの場所を明示する場合は `--font /path/to/font.ttf` を指定します。

手元での確認や、配信側に処理済み画像を保存する場合は、以下を実行します（入力パスは実際の配信環境に合わせてください）。

```sh
python3 /path/to/observatory_page/process_sky_camera.py /path/to/capt0000.jpg
```

出力先はスクリプトと同じディレクトリの `images/sky-camera.jpg` です。第2引数で出力先を変更できます。元画像を保存したまま、出力だけを一時ファイルから置き換えます。入力の読み込みや処理に失敗した場合、直前の処理済み画像を残します。

今回の2枚はともに画素サイズ4496×3000で、EXIF Orientationだけが1と6に切り替わっています。元の画素配置では北の目印が上側にあるため、Orientationによる回転を適用せず、中心の2400×2400を切り出して1200×1200に縮小します。元画像に焼き込まれた日付は切り取り範囲外です。中心・円の大きさが同じ固定カメラを前提としており、カメラ位置や画角を変更した場合は切り取り設定を再調整してください。取り付け角度の補正は `--rotation` で反時計回りの角度を指定できます。

円の周囲の余白に8方位（N・NE・E・SE・S・SW・W・NW）、下の余白にEXIFの撮影時刻と露光時間を白文字で描画します。配置は北が上、東が左、西が右、南が下です。これはサンプルの北の目印と午後の太陽が右下に写ることから推定した空を見上げる向きで、カメラの反転設定を変更する場合は方位の配置も再確認してください。撮影時刻はカメラに記録された時刻をそのまま使い、タイムゾーン変換は行いません。EXIFが欠けている場合は `unknown` と表示し、ページの読み込み時刻で代用しません。出力にはEXIFを引き継がず、ブラウザでも再回転されないようにしています。

JavaScriptを使わずに配信側で加工する運用へ変更する場合は、カメラ画像の転送処理へ上記コマンドを組み込み、ページ側も処理済み画像を再取得する方式へ変更してください。現在のページは元画像を取得してブラウザ内で加工する方式です。

サンプルを処理する場合:

```sh
python3 process_sky_camera.py images/20261002132003.jpg
python3 process_sky_camera.py images/capt0000.jpg /tmp/sky-camera-night.jpg
```

`latest.json` は以下の形式を想定しています。

```json
{
  "timestamp": "2026-06-01 16:34:00",
  "temperature_C": 23.85,
  "humidity_percent": 46.86,
  "pressure_hPa": 1010.86
}
```

外気センサーのデータは、HTMLと同じディレクトリの `latest_outside.json` に同じ形式で用意してください。外気でも項目名は `temperature_C`、`humidity_percent`、`timestamp` を使います。`pressure_hPa` は表示に使用しないため省略できます。ファイル名を変える場合は `observatory-dome.js` の `OUTER_STATUS_URL` を変更します。

温度は小数1桁、湿度は整数で表示します。ドームと外気は独立して読み込み、各センサーの取得時刻とステータスを表示します。取得成功時は「表示済み」、ファイルがない場合や値が不正な場合は「未取得」と表示し、そのセンサーの温度・湿度・取得時刻を `--` にします。過去に取得済みの値があっても消して、古い値を表示し続けないようにします。ファイルを用意すると、次の1分ごとの取得時に自動で表示を開始します。温湿度カード上部には全体のステータス（更新中・表示済み・一部未取得・未取得）、下部にはドームと外気の個別ステータスを横並びで表示します。狭い画面では個別ステータスを折り返します。

## データ出典・計算

- 天気予報: [MET Norway Locationforecast API](https://api.met.no/)
- 日の出・日の入り計算の参考: [日本と世界の日の出日の入り時間](https://www.motohasi.net/SunriseSunset/WorldSun.php)
- 夜間情報: 入来観測所付近の緯度経度からブラウザ上で計算。午前9時より前は前日の観測夜として扱います。

## 今後の予定
- ドーム内カメラの復活、配信開始
- ドーム内外の温度・湿度を取得、露点を計算して表示
- 観測天体の提案リストを表示（選別プログラムは別で用意する）
- 搭載中の装置を判別して、表示できるようにしたい
