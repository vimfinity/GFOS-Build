# Architecture Blueprint (CLI now, UI later)

## Kurzantwort zur zentralen Frage

Wenn aus einer CLI später eine UI entsteht (wie bei vielen erfolgreichen Dev-Tools), ist die Best Practice fast immer:

1. **Shared Application/Core Logic** als Library/Module
2. **Dünne Adapters** für CLI, UI, API, Worker
3. CLI-Aufrufe aus der UI nur als Übergang oder für Spezialfälle

Für GFOS Build ist damit der Zielpfad:
- UI ruft später die **Application-API** direkt auf
- nicht die eigene CLI über `spawn` als primären Weg

## Warum nicht einfach CLI im Hintergrund invoken?

Nachteile von "UI -> CLI subprocess":
- höherer Overhead und komplexeres Fehlerhandling
- schwierigere Typed-Contracts
- erschwerte Testbarkeit und Observability
- fragile Parsing-Grenzen (stdout/stderr)

Es kann sinnvoll sein für:
- Legacy-Kompatibilität
- schnelle Prototypen
- isolierte Sandbox/Privilege-Szenarien

Aber als Standard für ein wachsendes Produkt ist Shared Logic klar überlegen.

## Empfohlenes Zielbild für GFOS Build

```text
+-------------------+      +-------------------+
| CLI Adapter       |      | UI Adapter        |
| (src/cli)         |      | (future)          |
+---------+---------+      +---------+---------+
          |                          |
          +------------+-------------+
                       |
               +-------v-------+
               | Application    |
               | (use-cases)    |
               +-------+-------+
                       |
               +-------v-------+
               | Core Domain    |
               +-------+-------+
                       |
               +-------v-------+
               | Infrastructure |
               +---------------+
```

## Umsetzung im aktuellen Stand

- `createApplication()` kapselt die Laufzeit-Verdrahtung zentral.
- CLI verwendet diese Application direkt.
- Das gleiche Entry kann in Zukunft von UI/API genutzt werden.

## Best-Practice Arbeitsweise für künftige Features

1. Feature zuerst in `core` modellieren
2. Use-Case in `application` orchestrieren
3. Adapter in `infrastructure` ergänzen
4. CLI/UI als dünne Entry-Layer halten
5. Contract-Tests + Binary-Smoke beibehalten
