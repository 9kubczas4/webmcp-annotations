# Airline Booking Doctor

Jednoekranowy dashboard Angular do demonstracji współpracy człowieka i agenta w przeglądarce ChatGPT. Użytkownik wskazuje całą kartę wykresu przez natywną adnotację. Agent może odczytać dzienne kohorty, porównać lejek i wdrożenia oraz ustawić filtry we wspólnym widoku. Wszystkie dane są fikcyjne i oznaczone w aplikacji jako **Synthetic demo data**.

## Uruchomienie

Projekt został zbudowany z Angular i Angular CLI **22.3.0**, TypeScript **6.0.3** oraz Vitest **5.1.1**. Wersje są zapisane w `package-lock.json`. Testowane środowisko to Node.js **22.22.3** i npm **10.9.8**.

```sh
npm ci
npm start
npm run lint
npm run check:boundaries
npm test
npm run build
```

Dashboard działa pod [http://localhost:4200](http://localhost:4200/). Build statyczny trafia do `dist/airline-booking-doctor/browser/`. Dane są pakowane z lokalnych plików JSON. Aplikacja działa bez backendu i klucza API.

## Architektura frontendu

Kod Angulara, zasoby publiczne i arkusz stylów są w `src/frontend`. Główny komponent składa nagłówek i `RouterOutlet`. Trasa `/` korzysta z publicznego eksportu feature’u `booking-dashboard`. Reguły routingu aplikacji są w `app/core/routing`, a konfiguracja tras w `app.routes.ts`.

Dashboard jest jednym feature’em. `BookingDashboardPage` odczytuje sygnały stanu, a akcje przekazuje do `DashboardFacade`. Strona i handlery WebMCP działają na tej samej instancji `DashboardStore`, tworzonej dla strony z danymi dostarczonymi przez repozytorium.

| Warstwa       | Odpowiedzialność                                                                    |
| ------------- | ----------------------------------------------------------------------------------- |
| `domain`      | Typy, walidacja, agregacja kohort i obliczanie konwersji w czystych funkcjach.      |
| `state`       | Sygnały, dane pochodne, dziennik i synchroniczne, wersjonowane aktualizacje widoku. |
| `data-access` | Walidacja i ładowanie JSON, definicje narzędzi oraz adaptery API przeglądarki.      |
| `ui`          | Komponent wykresu oraz formatowanie liczb i dat na potrzeby prezentacji.            |
| `feature`     | Strona routowana, kompozycja dostawców, obsługa akcji i cykl życia integracji.      |

Importy między warstwami używają aliasów TypeScript. ESLint egzekwuje granice także dla importów względnych, a `npm run check:boundaries` sprawdza przykładowe dozwolone i zabronione zależności. Tailwind CSS v4 działa przez PostCSS, a globalny `src/frontend/styles.css` zawiera wspólną bazę i style dashboardu.

## Demonstracja w 3–5 minut

1. W trybie Work lub Codex w desktopowym ChatGPT otwórz adres w jego wbudowanej przeglądarce. Użyj obsługiwanego modelu. Jeśli integracje są wyłączone, sprawdź uprawnienia witryny oraz ustawienia **Enable site tools** i **Annotation features**. Hostowany wariant wymaga HTTPS. [Site tools](https://learn.chatgpt.com/docs/webmcp) · [Annotations Extensibility](https://learn.chatgpt.com/docs/annotations-extensibility)
2. Rozwiń **Integration diagnostics**. W przeglądarce z obsługą obu integracji panel pokazuje dwa statusy `available` oraz `3 registered`. W widoku początkowym **All traffic**, 3–20 XI, wskaż spadek dziennej konwersji z 4,0% do 3,4%.
3. Zaznacz całą kartę **Booking conversion** w trybie adnotacji lub kliknij **Ask about this chart**. Wpisz poniższy komentarz w natywnym edytorze i wyślij go do ChatGPT.

   > Investigate the conversion drop from November 12. Compare it with the preceding period, identify the affected segment and funnel steps, inspect nearby deployments, and show me the affected segment in this dashboard. Distinguish evidence from hypotheses.

4. Rozwiń **Activity**, żeby pokazać faktyczne wywołania i ich wyniki. W oczekiwanym widoku agent wybiera **Mobile · Safari**, zachowuje 3–20 XI, żeby pokazać oba okresy na jednym wykresie, i wyróżnia **Fare selector v2**. Kolejność odczytów może zależeć od modelu.
5. Przełącz na **Desktop · Chrome**. Linia utrzymuje się na poziomie 4,0%. **Reset demo** przywraca daty, segment i wyróżnienie oraz czyści lokalne **Activity**. Zmiana stanu zwiększa jego wersję.

### Wynik kontrolny

Porównujemy 3–11 XI z 12–20 XI. W każdym oknie jest po 90 000 sesji. Liczba zakupów spada z 3600 do 3060, a konwersja z 4,0% do 3,4% (−0,6 pp, względnie −15%). Cała różnica 540 zakupów przypada na Mobile Safari. W tym segmencie konwersja spada z 4,0% do 1,0%, przejście **Results viewed → Fare selected** z 50% do 25%, a **Checkout started → Purchase completed** z 40% do 20%. **Fare selector v2** wdrożono w dniu spadku. Dzienne kohorty nie ustalają kolejności zdarzeń w ciągu dnia i nie pozwalają przypisać wdrożeniu przyczynowości.

## Integracje

| Narzędzie               | Działanie                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query_booking_metrics` | Zwraca liczniki, proporcje, dzienny szereg, etapy lejka i cztery segmenty, opcjonalnie w porównaniu z równym wcześniejszym oknem. Zwraca też niezależny stan bieżącego widoku. |
| `get_deployments`       | Odczytuje chronologiczną historię wdrożeń według dni UTC.                                                                                                                      |
| `set_dashboard_view`    | Ustawia daty, segment i opcjonalne wyróżnienie w jednej operacji. Wymaga aktualnego `expectedStateVersion`.                                                                    |

Karty `booking-conversion-chart` oraz `booking-funnel-chart` udostępniają po sześć pól w `oai-annotation-metadata`. Metadane określają stan karty w chwili wskazania. Przed aktualizacją filtrów agent odczytuje `currentView`. W razie `STALE_VIEW` może ponownie odczytać widok i uwzględnić nowsze wybory użytkownika.

Narzędzia deklaruje eksperymentalne API Angulara `declareExperimentalWebMcpTool`. Angular wyrejestrowuje narzędzia po zniszczeniu injectora przypisanego do montażu dashboardu. Operacje trafiają do lokalnego dziennika w pamięci, a komentarzem zarządza host. [Specyfikacja WebMCP](https://webmachinelearning.github.io/webmcp/)

## Weryfikacja

- **Automatycznie.** Testy Vitest obejmują walidację 80 kohort, wyniki agregacji i obu spadków w lejku, pełny baseline, atomowość i wersjonowanie stanu oraz wyrenderowane metadane i reset. Testy adaptera z atrapą hosta sprawdzają schematy wykonania i wyrejestrowanie.
- **Wbudowana przeglądarka ChatGPT.** Odkryto i wywołano trzy rzeczywiste narzędzia na localhost. Odczyty zachowały wersję widoku. Zapis przełączył wszystkie karty na Mobile Safari i wyróżnił Fare selector v2. Próba zapisu ze starą wersją zwróciła `STALE_VIEW`. Panel **Activity** pokazał wykonane wywołania. Sprawdzono zmianę okresu, obsługę klawiatury, reset i układ przy szerokości 375 px.
- **Adnotacje w hoście.** Potwierdzono dostępność `document.oai.annotation.request`, przyjęcie żądania z przycisku i odświeżanie sześciu pól karty po zmianie widoku. Natywny edytor był poza dostępem automatyzacji. Ręczny test obejmuje zaznaczenie obu kart, anulowanie, wysłanie komentarza z metadanymi i odpowiedź modelu w rozmowie.
- **Chrome.** Dashboard i filtry działały bez API adnotacji. Przycisk był ukryty, a konsola nie zarejestrowała ostrzeżeń ani błędów. Ta instancja Chrome udostępniała WebMCP. Test komponentu sprawdza również renderowanie przy braku obu API.
