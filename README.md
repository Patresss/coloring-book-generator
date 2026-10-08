# Generator Kolorowanek

Aplikacja do generowania, przeglądania i drukowania kolorowanek na podstawie promptów głosowych lub tekstowych.

### 📝 [Blog](https://patres.dev/blog/ai-kolorowanki-dla-dzieci/)

### Demo - wideo:
[![Demo](https://github.com/Patresss/coloring-book-generator/blob/main/screenshots/video.png?raw=true)](https://www.youtube.com/shorts/d9mASueOgKw)

### Desktop:
![](https://github.com/Patresss/coloring-book-generator/blob/main/screenshots/desktop.png?raw=true)

### Mobile:
![](https://github.com/Patresss/coloring-book-generator/blob/main/screenshots/mobile.png?raw=true)

## Czym jest ta aplikacja?

Generator Kolorowanek to pełno-stackowa aplikacja webowa, która wykorzystuje sztuczną inteligencję (Gemini) do tworzenia czarno-białych ilustracji idealnych do kolorowania. Aplikacja umożliwia:
- **Generowanie kolorowanek** z opisów głosowych lub tekstowych
- **Automatyczne ulepszanie promptów** dla lepszych rezultatów
- **Rozpoznawanie obrazów referencyjnych** do dokładniejszego odwzorowania postaci
- **Drukowanie** bezpośrednio z aplikacji (opcjonalne)
- **Przeglądanie historii** wcześniej wygenerowanych kolorowanek

## Funkcje

### Główne możliwości
- **Prompt głosowy lub tekstowy**: Nagraj swoją prośbę lub wybierz gotową sugestię
- **Orientacja obrazu**: Tryb pionowy (2:3) lub poziomy (3:2)
- **Automatyczne drukowanie**: Opcja automatycznego wydruku po wygenerowaniu
- **Ulepszanie promptów**: AI rozszerza Twój opis dla lepszych rezultatów
- **Obrazy referencyjne**: Automatyczne wykrywanie i używanie obrazów referencyjnych z folderu
- **Historia**: Przeglądaj i ponownie drukuj wcześniej wygenerowane kolorowanki
- **Dźwięki**: Opcjonalne efekty dźwiękowe
- **Wskazówki**: Pomocne podpowiedzi dla nowych użytkowników
- **Ochrona hasłem**: Opcjonalna autentykacja

### Panel ustawień
- ✅ Automatyczne drukowanie po wygenerowaniu
- ✅ Ulepszanie promptów przez AI
- ✅ Tryb poziomy (domyślnie pionowy)
- ✅ Efekty dźwiękowe

### Proces generowania
1. **Nagrywanie** - Nagraj prompt głosowy lub wybierz sugestię
2. **Transkrypcja** - Przekształcenie mowy na tekst (OpenAI Whisper)
3. **Ulepszanie** - Opcjonalne wzbogacenie promptu (GPT)
4. **Wykrywanie referencji** - Automatyczne dopasowanie obrazów referencyjnych
5. **Generowanie** - Tworzenie kolorowanki (Gemini)
6. **Drukowanie** - Opcjonalne automatyczne wydrukowanie
7. **Gotowe** - Podgląd i możliwość pobrania/wydruku

## Wymagania

- **Node.js** 20+ i npm
- **Docker** i Docker Compose (opcjonalnie)
- **Klucz API Gemini** (wymagany)
- **Klucz API OpenAI** (wymagany)
- **Drukarka IPP** (opcjonalnie, dla funkcji drukowania)

## Instalacja i uruchomienie

### Docker Compose (zalecane)

#### Podstawowa konfiguracja

Stwórz plik `docker-compose.yml`:

```yaml
services:
  backend:
    image: ghcr.io/patresss/coloring-backend:latest
    container_name: coloring-backend
    dns:
      - 8.8.8.8
      - 1.1.1.1
    environment:
      - OPENAI_API_KEY=sk-twoj-klucz-openai
      - GEMINI_API_KEY=twoj-klucz-gemini
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 5

  frontend:
    image: ghcr.io/patresss/coloring-frontend:latest
    container_name: coloring-frontend
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "5173:80"
```

Uruchom aplikację:
```bash
docker-compose up -d
```

Aplikacja będzie dostępna pod adresem: `http://localhost:5173`

#### Konfiguracja zaawansowana (wszystkie opcje)

```yaml
services:
  backend:
    image: ghcr.io/patresss/coloring-backend:latest
    container_name: coloring-backend
    dns:
      - 8.8.8.8
      - 1.1.1.1
    environment:
      # WYMAGANE
      - OPENAI_API_KEY=sk-twoj-klucz-openai
      - GEMINI_API_KEY=twoj-klucz-gemini

      # OPCJONALNE - Drukowanie
      - PRINTER_URI=ipp://192.168.1.100/ipp/print
      - PRINTER_MEDIA=iso_a4_210x297mm

      # OPCJONALNE - Modele AI
      - GEMINI_IMAGE_MODELS=gemini-2.5-flash-image,gemini-3-pro-image-preview
      - GEMINI_IMAGE_ASPECT_RATIO=2:3
      - GEMINI_IMAGE_SIZE=1K
      - GEMINI_API_VERSION=v1beta
      - GEMINI_TIMEOUT_MS=600000
      - OPENAI_TEXT_MODEL=gpt-5-mini
      - OPENAI_STT_MODEL=whisper-1

      # OPCJONALNE - Konfiguracja
      - OPENAI_TIMEOUT_MS=240000
      - NODE_ENV=production
      - DATA_DIR=/data
      - REFERENCE_DIR=/reference
      - CORS_ORIGIN=http://localhost:5173
      - APP_PASSWORD=twoje-haslo-dostepu

      # OPCJONALNE - Dostosowanie promptów systemowych
      - PROMPT_COLORING_BOOK=prompt-dla-gemini
      - PROMPT_IMPROVE=prompt-do-ulepszania
      - PROMPT_DETECT_REFERENCES=prompt-do-wykrywania-referencji
    volumes:
      - ./data:/data
      - ./reference:/reference
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 5

  frontend:
    image: ghcr.io/patresss/coloring-frontend:latest
    container_name: coloring-frontend
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "5173:80"
```


### Lokalne uruchomienie (bez Docker)

#### Tryb deweloperski

1. **Backend** (API dostępne na `http://localhost:3000`):
   ```bash
   cd backend
   npm install
   cp ../.env.example .env
   # Edytuj .env i uzupełnij klucze API
   npm run dev
   ```

2. **Frontend** (Vite na `http://localhost:5173`):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

#### Tryb produkcyjny

1. **Backend**:
   ```bash
   cd backend
   npm install
   npm run build
   npm start
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   npm run preview
   ```

## Konfiguracja

### Diagnostyka połączeń AI na Synology

`Connection error.` w ulepszaniu promptu i wykrywaniu referencji oznacza, że klient
OpenAI nie nawiązał połączenia. Błąd wykrywania referencji zatrzymuje generowanie
przed wywołaniem Gemini. Odpowiedź `/health` potwierdza działanie serwera HTTP,
ale nie testuje połączenia z usługami AI.

Uruchom test **wewnątrz kontenera**. W aktualnym obrazie:

```bash
sudo docker exec coloring-backend npm run diagnose:network
```

W starszym obrazie, z katalogu zawierającego aktualny kod repozytorium na NAS:

```bash
sudo docker exec -i coloring-backend node --input-type=module < backend/scripts/diagnose-network.mjs
```

Test nie używa prawdziwych kluczy ani nie generuje płatnych obrazów. Sprawdza
połączenia domyślne, IPv4, IPv6, TLS oraz transport zainstalowanego SDK OpenAI.
HTTP 401 z OpenAI jest oczekiwane i potwierdza udane połączenie HTTPS.

- `ENOTFOUND` / `EAI_AGAIN`: sprawdź DNS kontenera i serwera NAS. Jeśli bezpośrednie zapytania do zewnętrznych resolverów działają, ustaw DNS backendu w Compose:

  ```yaml
  services:
    backend:
      dns:
        - 8.8.8.8
        - 1.1.1.1
  ```

  Po sprawdzeniu konfiguracji odtwórz tylko backend z obecnego obrazu:

  ```bash
  sudo docker compose config --quiet
  sudo docker compose up -d --no-deps --force-recreate --no-build --pull never backend
  ```

  Sama zmiana pliku Compose bez odtworzenia kontenera nie zmieni jego DNS.
- `ETIMEDOUT` / `ENETUNREACH` / `ECONNREFUSED`: sprawdź trasę, firewall i dostęp kontenera do internetu.
- `CERT_HAS_EXPIRED` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`: sprawdź czas NAS, certyfikaty CA i ewentualny proxy HTTPS.
- Jeśli domyślny transport SDK zawodzi, a jego wariant IPv4 działa: sprawdź konfigurację IPv6 sieci kontenera.

Samo niepowodzenie IPv6 jest dopuszczalne, gdy połączenie domyślne działa.
Nie wyłączaj weryfikacji certyfikatów TLS. Zwiększenie `OPENAI_TIMEOUT_MS` nie
rozwiązuje błędów DNS ani certyfikatów.

Zmiany w lokalnym kodzie wymagają przebudowania obrazu. `docker compose pull`
pobiera jedynie ostatnio opublikowany obraz; nie wdraża lokalnych poprawek.

### Zmienne środowiskowe

Stwórz plik `.env` w głównym katalogu lub w katalogu `backend/`:

```bash
# WYMAGANE
OPENAI_API_KEY=sk-twoj-klucz-openai
GEMINI_API_KEY=twoj-klucz-gemini

# OPCJONALNE - Drukowanie
PRINTER_URI=ipp://adres-drukarki/ipp/print
PRINTER_MEDIA=iso_a4_210x297mm

# OPCJONALNE - Foldery
DATA_DIR=./data
REFERENCE_DIR=./reference

# OPCJONALNE - Modele
GEMINI_IMAGE_MODELS=gemini-2.5-flash-image,gemini-3-pro-image-preview
GEMINI_IMAGE_ASPECT_RATIO=2:3
GEMINI_IMAGE_SIZE=1K
GEMINI_API_VERSION=v1beta
GEMINI_TIMEOUT_MS=600000
OPENAI_TEXT_MODEL=gpt-5-mini
OPENAI_STT_MODEL=whisper-1

# OPCJONALNE - Pozostałe
OPENAI_TIMEOUT_MS=240000
CORS_ORIGIN=http://localhost:5173
APP_PASSWORD=haslo-dostepu

# OPCJONALNE - Dostosowanie promptów systemowych
PROMPT_COLORING_BOOK=twoj-custom-prompt-dla-gemini
PROMPT_IMPROVE=twoj-custom-prompt-do-ulepszania
PROMPT_DETECT_REFERENCES=twoj-custom-prompt-do-wykrywania-referencji
```

Lista `GEMINI_IMAGE_MODELS` (wartości rozdzielone przecinkami) określa, jakie modele pojawią się w rozwijanej liście w oknie konfiguracji i mogą być przełączane bez restartu aplikacji.

### Obrazy referencyjne

Umieść obrazy referencyjne (np. zdjęcia członków rodziny, zwierząt domowych) w folderze `reference/`. Aplikacja automatycznie wykryje i użyje odpowiednich obrazów na podstawie promptu.

Przykład:
```
reference/
  ├── mama.jpg
  ├── tata.png
  ├── pies_burek.jpg
  └── kot_mruczek.jpg
```

Gdy użytkownik poprosi o "kolorowankę z Burkiem", aplikacja automatycznie użyje `pies_burek.jpg` jako referencję.

## Architektura

### Backend
- **TypeScript + Express** - API REST
- **Gemini 3 Pro** - Generowanie obrazów kolorowanek w rozdzielczości do 4K z obsługą do 14 obrazów referencyjnych
- **OpenAI Whisper** - Transkrypcja mowy na tekst
- **OpenAI GPT** - Ulepszanie promptów i wykrywanie referencji
- **IPP (Internet Printing Protocol)** - Drukowanie

### Frontend
- **React + Vite** - Szybki interfejs użytkownika
- **Material-UI** - Komponenty UI
- **Emotion** - Stylowanie


## Licencja
MIT

## Autor

Patryk Piechaczek ([@patresss](https://github.com/patresss))
