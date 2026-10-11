# Photo Puzzle Maker

Turn any photo into a jigsaw puzzle that kids can drag, turn and snap together.

## Run it

Double-click `index.html` — that's it. No install, no build step, no internet.
Everything (including your photo) stays on your computer.

## How to play

1. **Choose photo** to pick a picture, drag a photo onto the window, or paste one.
   No photo handy? Press **Sample picture**.
2. Pick how many pieces: **25**, **50**, **75** or **100**, and a board size with
   the 🖼️ button (tap to cycle):
   - **Small** — smaller picture, lots of room for loose pieces (easiest).
   - **Medium** — bigger picture with a tray of pieces beside or below it.
   - **Full** — the picture fills the screen and loose pieces lie on top of it,
     like tipping a real puzzle box onto the picture.

   The size you pick is remembered next time.
3. The photo is cut into real jigsaw pieces and scattered around the board.
4. **Drag** a piece to move it. **Tap/click** a piece to turn it a quarter turn
   (right-click or press `R` also turns it).
5. When a piece is in the right place *and* the right way up, it clicks into
   place with a sparkle and stays put. If it is in the right place but turned
   the wrong way, it flashes to say "turn me".
6. Place them all for confetti and a cheer. The finished picture grows to fill the
   screen; close the 🏆 card (✕, **See my puzzle**, tap outside it, or `Esc`) to
   admire it.

### Buttons

- **Shuffle** — re-scatter the pieces you haven't placed yet.
- **Peek** — fade the finished picture onto the board as a hint.
- **🖼️ Small / Medium / Full** — board size; changing it re-cuts the puzzle.
- **Play again** — recut the same photo with a brand new set of piece shapes.

## Notes

- Piece counts are targets. The app picks the grid that keeps pieces closest to
  square for your photo's shape, so 75 might become 70 and 25 might become 24.
  The real count is always shown in the status pill.
- The board is made as big as the chosen size allows, with the loose pieces in a
  tray beside it on wide screens or below it on tall ones (Small / Medium).
- Works with mouse, trackpad and touch screens. On iPad the toolbar stays compact
  and double-tap / pinch zoom is switched off so quick taps never zoom the page.
  Tip: *Share → Add to Home Screen* runs it full screen.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout and controls |
| `styles.css` | Kid-friendly styling |
| `jigsaw.js` | Grid choice and interlocking jigsaw outlines |
| `pieces.js` | Cropping the photo and drawing each piece |
| `interaction.js` | Drag, turn, snap and lock behaviour |
| `effects.js` | Sounds, sparkles and confetti |
| `sample.js` | The built-in sample picture |
| `main.js` | Wires everything together |

## Publishing

The site is served by GitHub Pages from `main`. Browsers cache files for up to
10 minutes, so when you change any `.js` or `.css` file, bump the `?v=` number on
every `<script>` / stylesheet link in `index.html`. That way a fresh page never
runs with old code.
