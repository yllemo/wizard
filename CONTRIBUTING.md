# Bidrag till Mötesassistent

Tack för att du vill bidra till Mötesassistent! Denna guide hjälper dig att komma igång.

## 🚀 Kom igång

### Förutsättningar
- PHP 7.4 eller senare
- CURL extension
- ZipArchive extension
- Git

### Installation för utveckling

1. **Forka repot** på GitHub
2. **Klona din fork:**
   ```bash
   git clone https://github.com/ditt-anvandarnamn/motesassistent.git
   cd motesassistent
   ```

3. **Konfigurera utvecklingsmiljö:**
   ```bash
   cp env.example .env
   # Redigera .env och sätt MOCK_MODE=true för testning
   ```

4. **Starta utvecklingsserver:**
   ```bash
   php -S localhost:8080
   ```

## 📝 Bidragsprocess

### 1. Skapa en branch
```bash
git checkout -b feature/din-funktion
# eller
git checkout -b bugfix/ditt-fix
```

### 2. Gör dina ändringar
- Följ befintlig kodstil
- Lägg till kommentarer för komplex kod
- Testa dina ändringar lokalt

### 3. Commita dina ändringar
```bash
git add .
git commit -m "Lägg till: beskrivning av ändringen"
```

### 4. Pusha till din fork
```bash
git push origin feature/din-funktion
```

### 5. Skapa Pull Request
- Gå till GitHub och skapa en Pull Request
- Beskriv vad du har ändrat och varför
- Länka till eventuella issues

## 🎯 Vad du kan bidra med

### Buggar
- Rapportera buggar via Issues
- Inkludera steg för att återskapa problemet
- Bifoga skärmdumpar om relevant

### Nya funktioner
- Diskutera stora ändringar via Issues först
- Följ befintlig arkitektur
- Uppdatera dokumentation

### Dokumentation
- Förbättra README.md
- Lägg till kommentarer i koden
- Skapa exempel och guider

### Design
- Förbättra responsivitet
- Lägg till tillgänglighetsfunktioner
- Förbättra användarupplevelse

## 📋 Kodstandarder

### PHP
- Använd PSR-12 kodstil
- Lägg till kommentarer för funktioner
- Hantera fel på ett konsekvent sätt

### JavaScript
- Använd moderna ES6+ funktioner
- Lägg till kommentarer för komplex logik
- Följ befintlig namngivning

### CSS
- Använd BEM-metodologi för CSS-klasser
- Organisera CSS-logiskt
- Lägg till kommentarer för komplexa regler

## 🧪 Testning

### Lokal testning
1. Testa alla funktioner manuellt
2. Kontrollera responsivitet på olika skärmstorlekar
3. Testa både med och utan API-nycklar (mock-läge)

### Testscenarier
- Skapa nytt möte
- Importera agenda
- Spela in ljud
- Transkribera ljud
- Fyll i mall med AI
- Exportera resultat

## 📁 Projektstruktur

```
motesassistent/
├── index.php              # Huvudapplikation
├── assets/
│   ├── css/app.css        # Styling
│   └── js/
│       ├── app.js         # Huvudapplikation
│       └── recorder.js    # Ljudinspelning
├── templates/             # Mallar
├── samples/               # Exempel
└── data/                  # Data (exkluderad från Git)
```

## 🐛 Rapportera buggar

Använd GitHub Issues och inkludera:

1. **Beskrivning** av problemet
2. **Steg för att återskapa** problemet
3. **Förväntat beteende**
4. **Faktiskt beteende**
5. **Miljö** (PHP-version, webbläsare, OS)
6. **Skärmdumpar** om relevant

## 💡 Föreslå funktioner

Skapa en Issue med:
1. **Beskrivning** av funktionen
2. **Användningsfall** och fördelar
3. **Förslag** på implementation
4. **Alternativ** du har övervägt

## 📞 Kontakt

- Skapa en Issue för frågor
- Diskutera stora ändringar innan implementation
- Var respektfull och konstruktiv

## 🙏 Tack

Tack för att du bidrar till Mötesassistent! Dina bidrag gör verktyget bättre för alla användare.

---

**Tillsammans bygger vi en bättre mötesassistent!** 🚀
