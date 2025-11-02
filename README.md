# Mötesassistent (Wizard)

En modern mötesassistent byggd i PHP som hjälper dig att automatisera mötesdokumentation med AI. Komplett lösning med möteshanterare, responsiv design och fullständig tillståndshantering.

## 🚀 Funktioner

### Grundläggande funktioner
- **📋 Agenda-hantering** - Importera och förhandsgranska agenda i Markdown med automatisk sektionssplittning
- **🎤 Ljudinspelning** - Direktinspelning via webbläsaren eller ladda upp flera ljudfiler samtidigt
- **🎵 Flera ljudfiler** - Ladda upp och hantera flera ljudfiler per möte, transkribera individuellt
- **📝 AI-transkribering** - Konvertera ljud till text med OpenAI Whisper (stöder alla vanliga format)
- **✏️ Redigerbart transkript** - Redigera och justera transkription direkt i gränssnittet
- **🔄 Automatisk sammanslagning** - Flera transkriptioner kombineras automatiskt till ett samlat dokument
- **🤖 Kontextuell AI-fyllning** - Chat med AI som fyller i mallar baserat på transkript och användarinstruktioner
- **👁️ Förhandsgranskning** - Renderad HTML-visning av mallar med full Markdown-support
- **📤 Komplett export** - Spara som Markdown, ZIP (med alla filer) eller Word-dokument

### Möteshantering
- **📁 Möteshanterare** - Skapa nya möten, hantera befintliga och fortsätt där du slutade
- **📝 Namnbyte på möten** - Byt namn på möten (både mapp och ID) enkelt från möteshanteraren
- **🧠 Mötesminne** - Varje möte har sitt eget tillstånd med inställningar och progress
- **💾 Automatisk sparning** - Allt sparas automatiskt när du byter steg
- **📦 Backup-system** - Automatisk backup av transkript och ifyllda mallar i versions-mapp

### Användargränssnitt
- **📱 Responsiv design** - Fungerar perfekt på desktop, tablet och mobil
- **🌓 Dark/Light mode** - Automatisk tema-växling med sparad preferens
- **♿ Tillgänglighet** - ARIA-labels, tangentbordsnavigering och hög kontrast
- **⚙️ Centraliserade inställningar** - Hantera API-nycklar och parametrar via .env-fil
- **🔔 Förbättrad felhantering** - Detaljerade felmeddelanden med felmodaler och toast-notifikationer
- **⏳ Loading indicators** - Tydliga visuella indikatorer för AI-operationer (transkribering och chat)
- **🎯 Diskreta focus outlines** - Förbättrad tillgänglighet med subtila fokus-stilar

## 🎨 Design

Använder Göteborgs färgschema med modern, responsiv design och förbättrad användarupplevelse. Stöder både mörkt och ljust tema med automatisk sparning av användarpreferenser.

## ⚙️ Installation

### Krav
- PHP 7.4 eller senare
- CURL extension
- ZipArchive extension
- Webb-server (Apache/Nginx) eller PHP built-in server

### Snabbstart

1. **Klona repot:**
   ```bash
   git clone https://github.com/ditt-anvandarnamn/motesassistent.git
   cd motesassistent
   ```

2. **Kopiera konfigurationsfilen:**
   ```bash
   # For local development
   cp config/env.example .env
   
   # For OpenShift (mount as persistent volume)
   cp config/env.example /config/.env
   ```
   
   **Viktigt:** Systemet söker efter `.env` i följande ordning:
   1. `/config/.env` - För OpenShift persistent storage
   2. `/.env` - För lokal utveckling (project root)

3. **Konfigurera API-nycklar (valfritt för demo):**
   Redigera `.env` och lägg till dina OpenAI API-nycklar:
   ```env
   # OpenAI API Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   LLM_API_KEY=your_openai_api_key_here
   
   # API URLs
   WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
   LLM_API_URL=https://api.openai.com/v1/chat/completions
   
   # Models
   WHISPER_MODEL=whisper-1
   
   # Timeout Configuration (important for OpenShift!)
   # Default: 1800 seconds (30 minutes) - sufficient for 1-hour audio files
   PHP_MAX_EXECUTION_TIME=1800
   CURL_TIMEOUT=1800
   CURL_CONNECT_TIMEOUT=60
   
   # Mock mode for testing without API keys
   MOCK_MODE=false
   ```

4. **Starta servern:**
   ```bash
   # Med PHP built-in server
   php -S localhost:8080
   
   # Eller med Apache/Nginx
   # Placera filerna i webbserverns document root
   ```

5. **Öppna i webbläsaren:**
   ```
   http://localhost:8080
   ```

### OpenShift installation

För OpenShift-miljö:

1. **Mount persistent storage för konfiguration:**
   ```yaml
   - name: config-volume
     mountPath: /config
     persistentVolumeClaim:
       claimName: wizard-config
   ```

2. **Kopiera konfigurationsfilen till persistent volume:**
   ```bash
   # In pod
   cp config/env.example /config/.env
   ```

3. **Redigera /config/.env med dina API-nycklar**

Systemet söker automatiskt efter `/config/.env` först, sedan fallback till `/.env` för kompatibilitet.

## 🔧 Konfiguration

### API-nycklar
- **OPENAI_API_KEY**: För Whisper-transkribering och LLM-anrop
- **LLM_API_KEY**: För mallfyllning med LLM (kan vara samma som ovan)
- **WHISPER_API_URL**: OpenAI Whisper API endpoint
- **LLM_API_URL**: OpenAI Chat API endpoint

### Modeller
- **WHISPER_MODEL**: Whisper-modell för transkribering (standard: whisper-1)

### Timeout-konfiguration (för OpenShift och långvariga uppgifter)
- **PHP_MAX_EXECUTION_TIME**: PHP max execution time i sekunder (standard: 1800 = 30 minuter, 0 = obegränsat)
- **CURL_TIMEOUT**: CURL timeout för API-anrop i sekunder (standard: 1800 = 30 minuter)
- **CURL_CONNECT_TIMEOUT**: CURL connection timeout i sekunder (standard: 60 = 1 minut)

**Tips för OpenShift:**
- Standard timeout på 1800 sekunder (30 minuter) är tillräckligt för att transkribera 1-timmars ljudfiler
- Öka timeout-värdena ytterligare om du arbetar med ännu längre filer (2+ timmar)
- Rekommenderade värden för OpenShift: PHP_MAX_EXECUTION_TIME=1800, CURL_TIMEOUT=1800
- Kontrollera även att OpenShift/PHP-inställningarna tillåter längre körningstider

### Mock-läge
Sätt `MOCK_MODE=true` i `.env` för att köra utan API-nycklar (demo-läge med exempeldata).

### Lagring
Alla möten sparas i `data/meetings/` mappen med unika ID:n eller egna namn. Varje möte har sin egen mapp med:
- `meeting_state.json` - Mötesstatus och metadata
- `agenda.md` - Originalmall/agenda
- `transcript.txt` - Aktuell transkribering (redigerbar)
- `filled.md` - AI-ifylld mall
- `chat_dialog.json` - Chat-konversation med AI
- `error.txt` - Fel-logg med detaljerade felmeddelanden för debugging
- `audio/` - Alla uppladdade ljudfiler
- `versions/` - Backup av tidigare versioner av transkript och ifyllda mallar

**Exempel på mappstruktur:**
```
data/meetings/
├── projektmote-2025/          # Eget namn
│   ├── meeting_state.json
│   ├── agenda.md
│   ├── transcript.txt
│   ├── filled.md
│   ├── chat_dialog.json
│   ├── error.txt
│   ├── audio/
│   │   ├── audio_20251016_120000_abc.mp3
│   │   └── audio_20251016_130000_def.wav
│   └── versions/
│       ├── transcript_20251016_120530.txt
│       └── filled_20251016_140000.md
└── meeting_20251015_143022_xyz/  # Autogenererat ID
    └── ...
```

## 📁 Projektstruktur

```
motesassistent/
├── index.php              # Huvudapplikation med API-endpoints
├── assets/                # CSS och JavaScript
│   ├── css/
│   │   └── app.css        # Styling med Göteborgs färger och responsiv design
│   └── js/
│       ├── app.js         # Huvudapplikation och API-anrop
│       └── recorder.js    # Ljudinspelning och MediaRecorder API
├── data/                  # Data-mapp (skapas automatiskt)
│   └── meetings/          # Sparade möten (exkluderad från Git)
├── templates/             # Fördefinierade mallar
├── samples/               # Exempel på agenda och mall
├── env.example            # Konfigurationsexempel
├── .gitignore             # Git ignore-fil
└── README.md              # Denna fil
```

## 🎯 Användning

### Grundläggande arbetsflöde

1. **📋 Steg 1: Agenda** 
   - Importera eller skriv agenda i Markdown
   - Välj en färdig mall eller skapa egen
   - Förhandsgranska med full Markdown-rendering

2. **🎤 Steg 2: Inspelning**
   - Spela in direkt via webbläsaren, eller
   - Ladda upp en eller flera ljudfiler
   - Alla filer visas i en lista med filstorlek och datum

3. **📝 Steg 3: Transkribera**
   - Transkribera varje ljudfil individuellt
   - Alla transkriptioner samlas i ett samlat dokument
   - Redigera transkriptet direkt för att justera eller lägga till information
   - Spara ändringar manuellt eller automatiskt när du byter steg

4. **🤖 Steg 4: AI-fyllning**
   - Chat med AI för att fylla i mallen baserat på transkriptet
   - Ge instruktioner för hur mallen ska fyllas i
   - Generera om mallen med en knapptryckning
   - Förhandsgranska resultat i realtid

5. **📤 Steg 5: Export**
   - **Markdown** - Exportera ifylld mall som .md-fil
   - **ZIP** - Ladda ner komplett mötespaket med alla filer och undermappar
   - **Word** - Exportera som .doc för kompatibilitet med MS Word
   - **Fel-logg** - Ladda ner `error.txt` för debugging och felanalys

### Möteshanterare

- **Skapa nytt möte** - Klicka på "Starta nytt möte" på startsidan
- **Hantera möten** - Klicka på mötes-ID (badge i headern) för att öppna möteshanteraren
- **Byt namn på möte** - I möteshanteraren kan du byta namn på både mapp och mötes-ID
- **Visa mötesstatus** - Se vilka möten som är tomma, pågående eller klara
- **Dela länkar** - Använd `?meeting=namn` för direktlänkar till specifika möten
- **Ladda ner ljudfiler** - Ladda ner enskilda ljudfiler från steg 2 och 3

### Mall-struktur

Alla mallar måste ha exakt två `#` rubriker:
- **Första sektionen**: Mötesagenda (visas på steg 2)
- **Andra sektionen**: Mall att fylla i (visas på steg 4)

### AI-fyllning

På steg 4 använder systemet:
- **Kontext**: Mall + transkribering + chat-historik
- **Systemprompt**: Konfigurerbar i inställningar
- **Chat**: Används för att ge instruktioner om hur mallen ska fyllas i
- **Resultat**: Uppdaterad ifylld mall visas till höger

### Stödda ljudformat

OpenAI Whisper stöder:
- **FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WebM**
- Automatisk konvertering av .dat-filer till .webm
- Filstorlek: upp till 100MB per fil
- **Flera filer**: Ladda upp obegränsat antal ljudfiler per möte

**Tips för bästa resultat:**
- Använd högkvalitativa ljudfiler (MP3 320kbps eller WAV)
- Separera långa möten i flera kortare filer för bättre hantering
- Namnge filer beskrivande (t.ex. "agenda-genomgang.mp3", "diskussion.mp3")

## 🔔 Felhantering och debugging

### Felmodal-system
- **Detaljerade felmeddelanden** - Klicka på felmeddelanden för att se fullständig information
- **Fel-loggning** - Alla fel loggas automatiskt till `error.txt` i mötesmappen
- **Kopiera fel** - Använd "Kopiera fel"-knappen för att dela felinformation
- **Visa fel-logg** - Ladda ner komplett felhistorik för debugging

### Toast-notifikationer
- **Fel** - Röd bakgrund, visas i 8 sekunder
- **Varning** - Gul bakgrund, visas i 6 sekunder  
- **Framgång** - Grön bakgrund, visas i 4 sekunder
- **Klick för att stänga** - Klicka på toast-meddelanden för att stänga dem

### Loading indicators
- **AI-transkribering** - Visar mikrofon-ikon och "Transkriberar ljudfil..."
- **AI-chat** - Visar robot-ikon och "AI bearbetar din fråga..."
- **Knappar** - Loading-spinner i knappar under operationer
- **Progress bars** - Animerade progress bars för långa operationer

### Automatisk felhantering
- **HTML-svar detektering** - Upptäcker när servern returnerar HTML istället för JSON
- **Nätverksfel** - Hanterar anslutningsproblem och timeouts
- **Rate limits** - Automatisk retry med exponential backoff
- **JSON-parsing** - Säker hantering av ogiltiga JSON-svar

## 🛠 Teknisk information

### Backend
- **PHP 7.4+** med session-hantering och mötesstatus
- **CURL** för API-anrop till OpenAI
- **ZipArchive** för export-funktionalitet
- **RecursiveDirectoryIterator** för filhantering

### Frontend
- **Vanlig HTML/CSS/JavaScript** - ingen framework-beroende
- **Göteborgs färgschema** med dark/light mode
- **Responsiv design** med CSS Grid och Flexbox
- **MediaRecorder API** för ljudinspelning

### AI-integration
- **OpenAI Whisper** för transkribering
- **OpenAI GPT** för mallfyllning
- **Retry-logik** med exponential backoff för rate limits
- **Omfattande felhantering** för API-fel, nätverksproblem och JSON-parsing
- **HTML-svar detektering** - Upptäcker timeouts och serverfel
- **Säker JSON-parsing** med detaljerad felinformation

### Markdown-rendering
- **marked.js** för Markdown-parsing
- **highlight.js** för syntax highlighting
- **mermaid.js** för diagram-rendering

### Lagring och export
- **Lokal filsystem** med mötesminne (.json filer)
- **Rekursiv ZIP-export** - Alla filer och undermappar inkluderas automatiskt
- **Word-export** med HTML-format för kompatibilitet
- **Markdown-export** för enkel redigering
- **Backup-system** - Automatiska versioner i `versions/` mapp
- **Namnbyte** - Byt namn på möten utan att förlora data

## 🔒 Säkerhet

- **API-nycklar** lagras endast i .env-fil (exkluderad från Git)
- **Inga känsliga data** i källkoden
- **Lokal lagring** - all data förblir på din server
- **Mock-läge** för säker testning utan API-nycklar

## 🐛 Felsökning

### Vanliga problem

1. **"API error (status: 429)"** - Rate limit nådd
   - **Lösning**: Vänta några minuter eller kontrollera din OpenAI-användning
   - Systemet försöker automatiskt igen med exponential backoff
   - **Felmodal**: Visar detaljerad information om rate limit-fel

2. **"Invalid file format"** - Ljudfil stöds inte
   - **Lösning**: Konvertera till MP3, WAV eller WebM
   - Systemet föreslår vilket format du ska konvertera till

3. **"Transcription failed"** - API-anrop misslyckades
   - **Lösning**: Kontrollera API-nycklar i .env-filen
   - Aktivera MOCK_MODE för att testa utan API-nycklar
   - **Felmodal**: Visar fullständig felinformation och råd

4. **"HTML-svar istället för JSON"** - Timeout eller serverfel
   - **Lösning**: Kontrollera internetanslutning och försök igen
   - Systemet upptäcker automatiskt HTML-svar och visar detaljerad information
   - **Felmodal**: Visar svarstext och status-kod

5. **"Cannot read properties of null"** - JavaScript-fel
   - **Lösning**: Ladda om sidan, detta borde inte hända längre
   - Systemet har nu omfattande null-kontroller för alla DOM-element

6. **"Invalid Date" i Möteshanteraren** - Datumformat-problem
   - **Lösning**: Fixa genom att uppdatera meeting_state.json med korrekta timestamps
   - Borde inte hända i nya möten

7. **Transkript försvinner** - Glömt spara
   - **Lösning**: Klicka "💾 Spara redigering" eller byt steg för auto-sparning
   - System sparar automatiskt när du navigerar

8. **Timeout-problem i OpenShift** - Request timeout eller script timeout
   - **Lösning**: Standard timeout är 1800 sekunder (30 minuter), tillräckligt för 1-timmars ljudfiler
   - Om du arbetar med längre filer, öka timeout-värdena i `.env`-filen:
   - Sätt `PHP_MAX_EXECUTION_TIME=3600` för att öka PHP execution time till 60 minuter
   - Sätt `CURL_TIMEOUT=3600` för att öka CURL timeout för API-anrop till 60 minuter
   - Sätt `CURL_CONNECT_TIMEOUT=60` för connection timeout (1 minut är oftast tillräckligt)
   - Sätt `IGNORE_USER_ABORT=true` för att förhindra att anslutningen stängs vid timeout
   - **Felmodal**: Visar detaljerad information om timeout-fel
   - **Loggning**: Timeout-värden loggas vid startup för debugging
   - **Gateway timeout (504)**: Kontrollera att OpenShift ingress timeout är minst lika hög som CURL_TIMEOUT

8a. **504 Gateway Timeout** - Ingress/gateway timeout innan PHP är klar
   - **Lösning**: Systemet använder nu `Connection: keep-alive` och `X-Accel-Buffering: no` headers
   - Kontrollera OpenShift ingress timeout-konfiguration (ska vara >= CURL_TIMEOUT)
   - Öka timeouts i OpenShift ingress/proxy-inställningar
   - Verifiera att `IGNORE_USER_ABORT=true` är satt

9. **ZIP-export fungerar inte i OpenShift** - Korrupt ZIP-fil eller tom fil
   - **Lösning**: Systemet använder nu förbättrad metod med `addFromString()` istället för `addFile()`
   - **Felhantering**: Automatisk fallback till `data/tmp/` om systemtemp-mappen inte är skrivbar
   - **Loggning**: Detaljerade felmeddelanden loggas i `error.txt` per möte
   - **Kontroll**: Verifierar att ZIP-filen har innehåll innan nedladdning
   - Systemet loggar varje fil som läggs till i ZIP:en för enkel debugging

### Felhantering och debugging

- **Felmodal**: Klicka på felmeddelanden för att se detaljerad information
- **Fel-logg**: Ladda ner `error.txt` från mötesmappen för fullständig felhistorik
- **Toast-notifikationer**: Korta felmeddelanden som visas i 8 sekunder (fel), 6 sekunder (varning), 4 sekunder (framgång)
- **Kopiera fel**: Använd "Kopiera fel"-knappen i felmodalen för att dela felinformation

### Debug-läge

Aktivera debug-läge genom att sätta `MOCK_MODE=true` i .env för att testa utan API-anrop.

## ✅ Implementerade funktioner

- [x] **Flera ljudfiler** - Ladda upp och transkribera flera ljudfiler per möte
- [x] **Individuell transkribering** - Välj vilken ljudfil som ska transkriberas
- [x] **Redigerbart transkript** - Justera och förbättra transkriptioner direkt
- [x] **Namnbyte på möten** - Byt namn på både mapp och mötes-ID
- [x] **Automatisk sammanslagning** - Flera transkriptioner kombineras automatiskt
- [x] **Backup-system** - Automatiska versioner av transkript och ifyllda mallar
- [x] **Rekursiv ZIP-export** - Alla filer och undermappar inkluderas (OpenShift-kompatibel)
- [x] **Auto-sparning** - Sparar automatiskt när du byter steg
- [x] **Rensa transkript** - Börja om från början med en knapptryckning
- [x] **Omfattande felhantering** - Detaljerade felmodaler med fullständig felinformation
- [x] **Fel-loggning** - Automatisk loggning av alla fel till `error.txt` per möte
- [x] **Loading indicators** - Tydliga visuella indikatorer för AI-operationer
- [x] **Säker JSON-parsing** - Hantering av HTML-svar, timeouts och nätverksfel
- [x] **Förbättrad tillgänglighet** - Diskreta focus outlines och bättre tangentbordsnavigering
- [x] **Toast-notifikationer** - Förbättrade meddelanden med olika typer och längre visningstid

## 📋 Planerade förbättringar

### 🚀 Nya funktioner
- [ ] **Lösenordsskydd** - Skydda känsliga möten med lösenord
- [ ] **Fler AI-modeller** - Val av GPT-4, GPT-3.5, lokala modeller
- [ ] **Större kontext** - Stöd för modeller med 128k+ tokens
- [ ] **Nästa/Tillbaka-knappar** - Enklare navigering mellan steg
- [ ] **Fler mallar** - Utökad samling av fördefinierade mallar
- [ ] **Sökning** - Sök i transkript och ifyllda mallar
- [ ] **Taggar** - Organisera möten med taggar
- [ ] **Samarbete** - Realtidsdelning av möten
- [ ] **Analys** - Statistik över möten och produktivitet
- [ ] **Batch-export** - Exportera flera möten samtidigt

### 🎨 Design-förbättringar
- [ ] **Fler teman** - Utökad färgpalett och anpassningsbara färger
- [ ] **Anpassningsbar layout** - Drag & drop för komponenter
- [ ] **Förbättrad tillgänglighet** - Mer ARIA-stöd och skärmläsarstöd
- [ ] **Responsiv tabell** - Bättre visning av tabeller på mobila enheter

### 🐛 Kända buggar
- [ ] **Favicon** - Röda inspelningsikon försvinner inte alltid efter inspelning
- [ ] **Performance** - Optimering för möten med många stora ljudfiler

### ✅ Nyligen fixade buggar
- [x] **"Cannot read properties of null"** - Omfattande null-kontroller för alla DOM-element
- [x] **HTML-svar vid timeout** - Automatisk detektering och hantering av icke-JSON svar
- [x] **Felmeddelanden för små** - Förbättrade toast-notifikationer med längre visningstid
- [x] **Focus outlines för störande** - Diskreta och tillgängliga fokus-stilar
- [x] **Saknade loading indicators** - Tydliga visuella indikatorer för AI-operationer

## 🤝 Bidrag

Bidrag är välkomna! Skapa en fork, gör dina ändringar och skicka en pull request.

### Utvecklingsmiljö

1. Klona repot
2. Kopiera `env.example` till `.env`
3. Sätt `MOCK_MODE=true` för testning
4. Starta PHP server: `php -S localhost:8080`

## 📄 Licens

Detta projekt är licensierat under MIT License - se [LICENSE](LICENSE) filen för detaljer.

## 🙏 Tack

- **OpenAI** för Whisper och GPT API:er
- **Göteborg** för inspiration till färgschema
- **Marked.js** för Markdown-rendering
- **Highlight.js** för syntax highlighting
- **Mermaid.js** för diagram-rendering

---

**Mötesassistent** - Automatisera din mötesdokumentation med AI! 🚀