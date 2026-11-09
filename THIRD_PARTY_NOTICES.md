# Screenshot recognition dependencies

The application's MIT license does not replace third-party licenses.

- [Tesseract.js 7.0.0](https://github.com/naptha/tesseract.js): Apache-2.0. The distribution copies its license and bundled dependency notices into `vendor/ocr/`.
- [Tesseract.js-core 7.0.0](https://github.com/naptha/tesseract.js-core): Apache-2.0. Its license is copied alongside the OCR engine.
- Simplified Chinese and English recognition data are provided by the pinned `@tesseract.js-data/chi_sim` and `@tesseract.js-data/eng` 1.0.0 packages from [naptha/tessdata](https://github.com/naptha/tessdata). These packages declare MIT; their Tesseract trained models originate from the [Tesseract OCR data project](https://github.com/tesseract-ocr/tessdata_best), distributed under Apache-2.0.

`npm run prepare:ocr` copies these dependencies from the installed, locked packages. `npm run build` includes them in the public site. Recognition uses same-origin assets; screenshots and extracted job descriptions are not sent to a recognition service.
