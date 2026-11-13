#!/usr/bin/env python3
"""
Lokalny serwer prototypu BEZ pamięci podręcznej przeglądarki.

Uruchom:  python3 narzedzia/serwer.py [port]        (domyślnie 5510; serwuje folder Main_Front-End/)
Adres:    http://localhost:5510/aplikacja.html      (z telefonu w tej samej sieci: http://<adres-maca>:5510/aplikacja.html)

Po co: zwykłe `python3 -m http.server` nie mówi przeglądarce, jak długo wolno trzymać pliki, więc ta zgaduje
i po zmianie kodu potrafi wczytać nowy plik razem ze starym z pamięci. 13.11.2026 skończyło się to tak, że nowy
checkin.js dostał stary moderacja.js i podlewanie w ogóle się nie otworzyło. Na teście z nastolatkami telefon
musi dostać dokładnie te pliki, które są na dysku, więc każdą odpowiedź wysyłamy z „Cache-Control: no-store”.
To tylko narzędzie do pracy i testów; nie jest serwerem produkcyjnym.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'Main_Front-End'


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5510
    server = ThreadingHTTPServer(('', port), partial(NoCacheHandler, directory=str(ROOT)))
    print(f'ReLeaf: http://localhost:{port}/aplikacja.html  (folder {ROOT}, bez pamięci podręcznej; Ctrl+C kończy)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
