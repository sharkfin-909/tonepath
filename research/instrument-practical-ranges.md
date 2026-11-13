# Instrument practical ranges

Ticket: [issues/013](../issues/013-instrument-practical-ranges.md) · Researched 2026-11-12

**Question.** For each instrument in the v1 list from [Instrument view](../issues/011-instrument-view.md), what is the **practical written range** (what a competent player reliably plays, not altissimo or extreme), in scientific pitch notation (C4 = middle C)? What is its transposition and the resulting concert range? Cite a source for each, note where sources disagree, and say whether one range serves both double bass and 4-string bass guitar.

**Method.** I read the Vienna Symphonic Library *Instrumentology* pages (vsl.co.at/academy/…) for each orchestral instrument, the Symphony Orchestra Library Center range table (orchestralibrary.com/reftables/rang.html), and the McGill ACTOR *Timbre and Orchestration Resource* page on the saxophone family. I also used the UNSW Music Acoustics saxophone pages (newt.phys.unsw.edu.au) for the saxophone's written low note. All three primary sources use C4 = middle C (the flute's low C on the C footjoint is C4, and the violin's open G is G3). Where a source gives only sounding pitch, I converted it to written pitch myself, and the notes say so. I could not reach Adler, Blatter or Piston online. Blatter (2nd ed., Schirmer 1997) is the one standard text that gives separate elementary, high-school and professional ranges for each instrument, so a library copy would be the best check on the "practical" upper limits I chose below. Concert ranges are computed as written minus the transposition interval.

---

## Paste-ready table

All ranges are **practical**, in **scientific pitch notation** (C4 = middle C). Written = concert + interval.

| Instrument | Written range | Transposition (written vs concert) | Concert range | Source |
|---|---|---|---|---|
| Flute | C4–C7 | unison | C4–C7 | VSL *Concert Flute* (standard B3–D7; D7 forced) |
| Violin | G3–E7 | unison | G3–E7 | VSL *Violin* (G3–A7); orchestralibrary.com (G3–A7) |
| Trombone (tenor) | E2–B♭4 | unison | E2–B♭4 | VSL *Tenor Trombone* (E2–F5; up to 8th–10th natural "generally") |
| Vibraphone | F3–F6 | unison | F3–F6 | VSL *Vibraphone* (3-octave F3–F6); orchestralibrary.com (F3–F6) |
| B♭ trumpet | F♯3–C6 | up M2 | E3–B♭5 | VSL *Trumpet* ("as a rule up to C6"); orchestralibrary.com (F♯3–D6) |
| B♭ clarinet | E3–A6 | up M2 | D3–G6 | VSL *Clarinet* (written E3–C7; "to G6 [concert] in orchestral playing") |
| B♭ soprano sax | B♭3–F♯6 | up M2 | A♭3–E6 | McGill TOR *Saxophone family* (conventional top F♯6); UNSW (low B♭3) |
| B♭ tenor sax | B♭3–F♯6 | up M9 | A♭2–E5 | same as soprano |
| E♭ alto sax | B♭3–F♯6 | up M6 | D♭3–A5 | same as soprano |
| E♭ baritone sax | B♭3–F♯6 | up P8 + M6 | D♭2–A4 | same as soprano (modern baris add low A3 → concert C2) |
| F horn | C3–G5 | up P5 | F2–C5 | VSL *Horn in F* (sounding B1–F5; naturals 12–16 "very difficult"); orchestralibrary.com (written F♯2–C6) |
| Guitar | E3–E6 | up P8 | E2–E5 | orchestralibrary.com (E3–E6, "upper range may extend") |
| Double bass / bass guitar | E2–G4 | up P8 | E1–G3 | VSL *Double Bass* (4-string E1 G2 open strings; G string to G4 concert); bass guitar same tuning, open E to 12th fret G string |

The same data as rows to drop into code (written, low–high):

```
Flute            C4  C7   P1
Violin           G3  E7   P1
Trombone         E2  Bb4  P1
Vibraphone       F3  F6   P1
Bb trumpet       F#3 C6   M2
Bb clarinet      E3  A6   M2
Bb soprano sax   Bb3 F#6  M2
Bb tenor sax     Bb3 F#6  M9
Eb alto sax      Bb3 F#6  M6
Eb baritone sax  Bb3 F#6  M13   (P8 + M6)
F horn           C3  G5   P5
Guitar           E3  E6   P8
Double bass / bass guitar  E2 G4  P8
```

---

## Notes per instrument

**Flute.** VSL says: "The concert flute's standard range is from B3 - D7 (forced up to F7)." The B3 needs a B footjoint ("The C footjoint is standard; with this notes from Eb4 to C4 can be played"). VSL says D7 "requires a forced attack" and that notes above it "are therefore not called for in orchestral literature". orchestralibrary.com gives C4–D7. I chose **C4–C7**, which drops the footjoint-dependent B3 and the forced D7. The professional range is B3/C4–D7.

**Violin.** VSL gives "G3 - A7 (harmonic D8)", noting that high positions are "required particularly in virtuoso solo performance". orchestralibrary.com also gives G3–A7. Neither source separates practical from extreme. I chose **E7** as the practical top, because the top fifth (E7–A7) is the virtuoso territory both sources point to. This is my judgement, not a figure from either source. Professional range: G3–A7.

**Trombone (tenor).** VSL gives "Range of the tenor trombone: E2 - F5", with pedal tones E1–B♭1. It also says "Overblowing is generally used up to the 8th, 9th or 10th natural. Only very proficient players can overblow as far as the 12th natural." On a B♭ fundamental, the 8th, 9th, 10th and 12th naturals are B♭4, C5, D5 and F5. I chose **E2–B♭4**, the bottom of VSL's "generally used" band. D5 is defensible for a strong jazz or lead player, and F5 is the professional top. orchestralibrary.com agrees on E2–F5 and adds pedals and an F-trigger extension down to C2/B1.

**Vibraphone.** VSL: "Vibraphone with three octaves: F3 - F6"; "three and a half octaves: C3 - F6". The vibraphone sounds as written. orchestralibrary.com gives F3–F6. **F3–F6** is the safe common range, and a 3½-octave instrument (C3–F6) is a possible later row.

**B♭ trumpet.** VSL gives the range only for the C trumpet: "F#3 - C6 (occasionally F6)… As a rule the scale goes up to C6… Highly proficient trumpeters can reach the 11th natural (F6)… Particularly in jazz there are no limits." The B♭ trumpet has the same written range and fingering, and it "sounds a major second lower than written". orchestralibrary.com gives written F♯3–D6. I chose written **F♯3–C6**, which is concert E3–B♭5. Disagreement: C6 (VSL) vs D6 (orchestralibrary.com), with jazz lead players far higher. School charts usually stop around G5–A5.

**B♭ clarinet.** VSL: "On all clarinets the written compass ranges from E3 - C7… The clarinet in Bb has a range from D3 - Bb6 (to G6 in orchestral playing)". It adds "from A6 upward they sound piercing and shrill". orchestralibrary.com gives written E3–C7. I chose written **E3–A6**, which is concert D3–G6, following VSL's orchestral limit. Professional range: written E3–C7. Some instruments have a low E♭ key (written E♭3).

**Saxophones (soprano, alto, tenor, baritone).** All four share one written range and one set of fingerings. McGill TOR: "all surviving members of the saxophone family have the same fingering and basic written range… The top of the conventional range of all saxophones is written F♯6"; altissimo lies above that. The UNSW acoustics measurements, taken on soprano and tenor, start at written A♯3/B♭3, the standard low B♭. I chose written **B♭3–F♯6** for every saxophone and derived each concert range from its transposition. Disagreements:
- orchestralibrary.com gives the top as **G6**, because some modern sopranos (and some altos) have a high-G key. TOR counts G6 as the start of altissimo.
- Many older or student instruments lack the high-F♯ key, so **F6** is the cautious top.
- Modern baritones extend to **low A3** (concert C2), according to orchestralibrary.com. Some professional tenors do too. I kept B♭3 so that one written range serves the whole family.

**F horn.** VSL gives sounding pitch only: "The horn in F has a range from B1 - F5 (sounding)… the naturals 12 to 16 are very difficult to play… Difficulties arise with leaps to the naturals from the 13th upward". It says the lowest notes "develop only very slowly and ponderously". Up a P5, that is written F♯2–C6, which matches orchestralibrary.com's written F♯2–C6. The 12th natural is written G5, and the 2nd natural (the open low register) is written C3. I chose written **C3–G5**, which is concert F2–C5, by applying VSL's harmonic-series comments. This is my derivation. Professional range: written F♯2–C6.

**Guitar.** orchestralibrary.com gives written **E3–E6**, sounding an octave lower (E2–E5), and says the "upper range may extend depending on the player's ability". That top is the 12th fret on the high E string. A classical guitar's 19th fret reaches written B6, and a 22-fret electric reaches written D7. Those are my fret arithmetic, not a source figure. Hugill's *Orchestra: A User's Manual* (guitar page) confirms "All guitars sound an octave lower than written" but gives the range only as an image.

**Double bass / bass guitar.** **One range serves both.** The 4-string double bass is "tuned to intervals of a fourth: E1, A1, D2, G2" (VSL), "written an octave higher than it sounds". The 4-string bass guitar uses the same tuning and the same octave transposition. VSL gives the double bass range as B0 (5-string) to G4 sounding, with the G string covering G2–G4. orchestralibrary.com gives written C2–C5, which includes the low-C extension. For bass guitar, open E to the 12th fret of the G string sounds E1–G3. That is the practical range widely quoted for the instrument (the higher frets thin out), and 20–24 frets reach concert E♭4–G4. I chose written **E2–G4**, which is concert E1–G3, the common practical span. A double bassist in thumb position, or a bassist above the 12th fret, plays higher: professionally up to about written G5 (concert G4). The C extension and 5-string (B0/C1) lie below this range and are out of scope.

---

## Disagreements worth knowing

1. **The practical top is a judgement call for brass, clarinet and violin.** None of the reachable sources gives a separate "school" range, which only Blatter does. I set the tops from each source's own wording ("as a rule", "in orchestral playing", "generally used", "very difficult"). Trombone (B♭4) and horn (G5) are the most conservative and the most open to challenge. Because out-of-range notes are **flagged, never blocked** (decision 4 in ticket 011), a slightly conservative range costs little.
2. **Sax top: F6, F♯6 or G6.** I followed TOR's "conventional" F♯6.
3. **Trumpet top: C6 or D6.** VSL gives C6 and orchestralibrary.com gives D6. Jazz players routinely go higher.
4. **Flute low: B3 or C4.** B3 needs a B footjoint, so I chose C4.
5. **Low extensions** (baritone sax low A, clarinet low E♭, double bass C extension, 3½-octave vibes) are left out of the ranges in favour of the common instrument.

## Sources

- Vienna Symphonic Library, *Instrumentology*: [Concert Flute](https://vsl.co.at/academy/woodwinds/concert-flute), [Clarinet](https://vsl.co.at/academy/woodwinds/clarinet), [Trumpet](https://vsl.co.at/academy/brass/trumpet-c), [Horn in F](https://vsl.co.at/academy/brass/horn-f), [Tenor Trombone](https://vsl.co.at/academy/brass/tenor-trombone), [Violin](https://vsl.co.at/academy/strings/violin), [Double Bass](https://vsl.co.at/academy/strings/double-bass), [Vibraphone](https://vsl.co.at/academy/percussion/vibraphone)
- Symphony Orchestra Library Center, [Range of Instruments](https://www.orchestralibrary.com/reftables/rang.html)
- McGill ACTOR Project, *Timbre and Orchestration Resource*, [The Saxophone Family](https://timbreandorchestration.org/isfee/extreme-orchestration/woodwinds/saxophone-family) (Freund & Cutler, 2024)
- UNSW Music Acoustics, [Saxophone acoustics](https://newt.phys.unsw.edu.au/music/saxophone/) (written-pitch note pages from A♯3)
- Andrew Hugill, *The Orchestra: A User's Manual*, [Guitar](https://andrewhugill.com/OrchestraManual/frets_guitar.html)
- Not consulted (not reachable online): Adler, *The Study of Orchestration*; Blatter, *Instrumentation and Orchestration* (2nd ed., 1997; three-tier ranges for each instrument); Piston, *Orchestration*.
