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
   cp env.example .env
   ```

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

## 🔧 Konfiguration

### API-nycklar
- **OPENAI_API_KEY**: För Whisper-transkribering och LLM-anrop
- **LLM_API_KEY**: För mallfyllning med LLM (kan vara samma som ovan)
- **WHISPER_API_URL**: OpenAI Whisper API endpoint
- **LLM_API_URL**: OpenAI Chat API endpoint

### Modeller
- **WHISPER_MODEL**: Whisper-modell för transkribering (standard: whisper-1)

### Mock-läge
Sätt `MOCK_MODE=true` i `.env` för att köra utan API-nycklar (demo-läge med exempeldata).

### Lagring
Alla möten sparas i `data/meetings/` mappen med unika ID:n eller egna namn. Varje möte har sin egen mapp med:
- `meeting_state.json` - Mötesstatus och metadata
- `agenda.md` - Originalmall/agenda
- `transcript.txt` - Aktuell transkribering (redigerbar)
- `filled.md` - AI-ifylld mall
- `chat_dialog.json` - Chat-konversation med AI
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
- **Felhantering** för API-fel och nätverksproblem

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

2. **"Invalid file format"** - Ljudfil stöds inte
   - **Lösning**: Konvertera till MP3, WAV eller WebM
   - Systemet föreslår vilket format du ska konvertera till

3. **"Transcription failed"** - API-anrop misslyckades
   - **Lösning**: Kontrollera API-nycklar i .env-filen
   - Aktivera MOCK_MODE för att testa utan API-nycklar

4. **"Invalid Date" i Möteshanteraren** - Datumformat-problem
   - **Lösning**: Fixa genom att uppdatera meeting_state.json med korrekta timestamps
   - Borde inte hända i nya möten

5. **Transkript försvinner** - Glömt spara
   - **Lösning**: Klicka "💾 Spara redigering" eller byt steg för auto-sparning
   - System sparar automatiskt när du navigerar

### Debug-läge

Aktivera debug-läge genom att sätta `MOCK_MODE=true` i .env för att testa utan API-anrop.

## ✅ Implementerade funktioner

- [x] **Flera ljudfiler** - Ladda upp och transkribera flera ljudfiler per möte
- [x] **Individuell transkribering** - Välj vilken ljudfil som ska transkriberas
- [x] **Redigerbart transkript** - Justera och förbättra transkriptioner direkt
- [x] **Namnbyte på möten** - Byt namn på både mapp och mötes-ID
- [x] **Automatisk sammanslagning** - Flera transkriptioner kombineras automatiskt
- [x] **Backup-system** - Automatiska versioner av transkript och ifyllda mallar
- [x] **Rekursiv ZIP-export** - Alla filer och undermappar inkluderas
- [x] **Auto-sparning** - Sparar automatiskt när du byter steg
- [x] **Rensa transkript** - Börja om från början med en knapptryckning

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