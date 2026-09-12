# Workspace Discovery Report

## Scan Date: 2026-09-11

## Methodology
- Scanned `/home/martin` up to 2+ levels deep for project indicator files (`index.html`, `package.json`, `manifest.json`, `config.js`, `app.js`, `main.js`, `server.js`)
- Filtered out: `node_modules`, `.git`, `dist`, `build`, `snap/`, `R/`, `Android/Sdk/`, and other system directories
- Grouped remaining files by parent directory to identify distinct project roots

---

## Distinct Project Directories (13 total)

### 1. `/home/martin/src`
- **Project Type:** Single-file PWA
- **Primary Entry Point:** `index.html`
- **Supporting Files:** `js/modules.js`, `sw.js` (service worker)
- **Notes:** Inline PWA with `PWAInstaller.init()`, `window.APP_CONFIG`, responsive nav layout

### 2. `/home/martin/WebApps/dropdown/my-app`
- **Project Type:** Node/Vite App (Create React App)
- **Primary Entry Point:** `src/index.js`
- **Supporting Files:** `public/index.html`, `public/manifest.json`, `src/App.js`, `src/index.css`
- **Dependencies:** React 16.13.1, react-scripts 3.4.1, @material-ui/core

### 3. `/home/martin/WebApps/StockScreener/candlestick-screener`
- **Project Type:** Python/Flask App
- **Primary Entry Point:** `app.py`
- **Supporting Files:** `templates/index.html`, `chartlib.py`, `patterns.py`, `pattern_detect.py`, `requirements.txt`
- **Dependencies:** Flask, talib, yfinance, pandas

### 4. `/home/martin/WebApps/python_selenium`
- **Project Type:** Python Script (Selenium automation)
- **Primary Entry Point:** `main.py`
- **Notes:** Automated web scraping of spitogatos.gr using Firefox WebDriver

### 5. `/home/martin/WebApps/python`
- **Project Type:** Python Module/Script
- **Primary Entry Point:** `humansize.py`
- **Notes:** Single-file Python module

### 6. `/home/martin/WebApps/stocks/python`
- **Project Type:** Python Full-Stack Web App (Stock Trading)
- **Primary Entry Point:** `hello.py`
- **Supporting Files:** `create_db.py`, `download.py`, `alpaca.py`, `populate_db.py`, `app.db`, `.venv/`, `FullStackWebApp/config.py`
- **Notes:** Stock price database management with Alpaca API integration

### 7. `/home/martin/AndroidStudioProjects/MyFirstApp`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Basic Android app with `com.example.myfirstapp` package

### 8. `/home/martin/AndroidStudioProjects/SiderDrawer`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Android app with navigation drawer

### 9. `/home/martin/AndroidStudioProjects/Sunflower`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Google's Sunflower gardening sample app

### 10. `/home/martin/AndroidStudioProjects/RoomRxJavaKotlin`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Room database + RxJava + Kotlin sample

### 11. `/home/martin/AndroidStudioProjects/RoomRxJavaKotlin1`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Variant of RoomRxJavaKotlin project

### 12. `/home/martin/AndroidStudioProjects/TopekaforAndroid`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Google's Topeka quiz app sample

### 13. `/home/martin/AndroidStudioProjects/test1`
- **Project Type:** Android (Gradle) Project
- **Primary Entry Point:** `app/src/main/AndroidManifest.xml`
- **Notes:** Android app project

---

## Summary Statistics
- **Total distinct project roots:** 13
- **Web/JS projects:** 2 (src PWA, my-app React)
- **Python projects:** 4 (Flask, Selenium, module, stock trading)
- **Android projects:** 7
- **Empty/non-project directories excluded:** pwa-test, Bicycle Project, kitrinos, Documents/, Downloads/, RNotebooks/
