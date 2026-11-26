# Tesseract (글자 인식, OCR)

전부 npm 패키지에서 받은 그대로 (수정 없음). 2026-11-26.

| 파일 | 출처 | SHA-256 |
|---|---|---|
| `tesseract.min.js` | tesseract.js 7.0.0 `dist/` | `000C27D9CD0DEF655F77B36C72A389C0AB13793AA31CB4D7AAB56D09C0AFBC7E` |
| `worker.min.js` | tesseract.js 7.0.0 `dist/` | `576B7DF7E3393E137E51849357C9ADB53FE7AC1BB69BFA06CF3D61520F182C6D` |
| `tesseract-core-simd-lstm.js` | tesseract.js-core 7.0.0 | `E48E2F02DDAE3716C8DD24BF41CD290D4EFA96892D689CDC4013C2545D63F469` |
| `tesseract-core-simd-lstm.wasm` | tesseract.js-core 7.0.0 | `34E8D50CAC216427D86BF397D610FDD9F49492539BBCDFBFCCC4EDA20C810BEA` |
| `lang/kor.traineddata.gz` | @tesseract.js-data/kor 1.0.0 `4.0.0_best_int/` | `78C21276AB14C9BB734D83BE1055D9FE5469A4E7E977C51AD385BE5737E61126` |
| `lang/eng.traineddata.gz` | @tesseract.js-data/eng 1.0.0 `4.0.0_best_int/` | `45B4CB346724AC1774F1C36F42F182B887BCDB28EBE63E6FFF90AC41F3FCFF91` |

- 라이선스: tesseract.js, tesseract.js-core는 Apache-2.0 (`LICENSE-*`). 학습 데이터 패키지는 MIT.
- 기본 설정은 jsDelivr CDN에서 파일을 받는다. `js/ocr.js`에서 workerPath, corePath, langPath를 전부 이 폴더로 지정해서 외부 요청이 없게 한다.
- 엔진은 SIMD 버전 하나만 넣었다 (iOS 16.4 이상, 최신 크롬). 구형 기기용은 안 넣음.
