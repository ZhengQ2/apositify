import Foundation

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else {
        fputs("FAIL: \(message)\n", stderr)
        exit(1)
    }
}

func line(_ text: String, confidence: Float = 0.96) -> RecognizedLine {
    RecognizedLine(
        text: text,
        confidence: confidence,
        bounds: NormalizedRect(x: 0, y: 0, width: 1, height: 0.05)
    )
}

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: ApositifyCoreTests /path/to/e-registers.json\n", stderr)
    exit(2)
}

let catalogURL = URL(fileURLWithPath: CommandLine.arguments[1])
let catalog = try JSONDecoder().decode(RegisterCatalog.self, from: Data(contentsOf: catalogURL))
expect(catalog.entries.count == 97, "the iOS catalog must contain all 97 authority entries")

let validStickerBarcode = ChinaStickerBarcode.recognizedLine(
    payload: "e00268460",
    visionBounds: NormalizedRect(x: 0.66, y: 0.78, width: 0.2, height: 0.05)
)
expect(validStickerBarcode?.text == "Sticker Number: E00268460", "the upper-right China barcode must become sticker-number evidence")
expect(
    ChinaStickerBarcode.recognizedLine(
        payload: "E00268460",
        visionBounds: NormalizedRect(x: 0.66, y: 0.20, width: 0.2, height: 0.05)
    ) == nil,
    "the same value outside the upper-right sticker position must be rejected"
)
expect(ChinaStickerBarcode.normalizedValue(from: "E0026846O") == nil, "OCR-like letters must not be accepted as barcode digits")

let recognition = RecognitionResult(lines: [
    line("APOSTILLE (Convention de La Haye du 5 octobre 1961)"),
    line("Application number: APP-4207"),
    line("1. Country: Ukraine"),
    line("2. This public document has been signed by Example Person"),
    line("3. acting in the capacity of Registrar"),
    line("4. bears the seal / stamp of the university"),
    line("5. at Kyiv"),
    line("6. dated 18 July 2026"),
    line("7. by Ministry of Education and Science"),
    line("8. No. UA-123456"),
    line("9. Seal / stamp"),
    line("10. Signature")
])

let matches = AuthorityMatcher(entries: catalog.entries).matches(for: recognition)
expect(matches.first?.entry.id == "ukraine-ministry-of-education-and-science", "OCR text must route to Ukraine's education authority")
expect((matches.first?.score ?? 0) >= 0.8, "country and authority match must be high confidence")

let ukraine = catalog.entries.first { $0.id == "ukraine-ministry-of-education-and-science" }!
let extracted = ApostilleParser.extractFields(for: ukraine, from: recognition)
let values = Dictionary(uniqueKeysWithValues: extracted.map { ($0.id, $0.value) })
expect(values["apostilleNumber"] == "UA-123456", "item 8 must populate the Apostille number")
expect(values["applicationNumber"] == "APP-4207", "a labeled application number must be extracted")
expect(values["apostilleDate"] == "18.07.2026", "item 6 must be normalized to the portal's dotted date format")

if case .get(let url) = VerificationRouter.route(for: ukraine, values: values) {
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let query = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).compactMap { item in
        item.value.map { (item.name, $0) }
    })
    expect(query["apoNum"] == "UA-123456", "GET handoff must map the Apostille number")
    expect(query["reqNum"] == "APP-4207", "GET handoff must map the application number")
    expect(query["apoDate"] == "18.07.2026", "GET handoff must map the issue date")
    expect(query["task"] == "searchApo", "GET handoff must preserve required static parameters")
} else {
    expect(false, "Ukraine must produce a GET handoff")
}

let moldova = catalog.entries.first { $0.id == "moldova-republic-of-ministry-of-justice" }!
let moldovaValues = ["apostilleCode": "MD 100/26", "securityCode": "A&B 9"]
if case .post(let request) = VerificationRouter.route(for: moldova, values: moldovaValues) {
    expect(request.httpMethod == "POST", "Moldova must use POST")
    let body = String(data: request.httpBody ?? Data(), encoding: .utf8) ?? ""
    expect(body.contains("apostila_code=MD+100%2F26"), "POST body must form-encode the Apostille code")
    expect(body.contains("security_code=A%26B+9"), "POST body must form-encode the security code")
} else {
    expect(false, "Moldova must produce a POST handoff")
}

let invalidMoldovaValues = ["apostilleCode": "ARIJ-123", "securityCode": "ABC"]
expect(
    FieldValidator.error(for: moldova.verification!.fields[0], value: invalidMoldovaValues["apostilleCode"]!) != nil,
    "ARIJ-prefixed Moldova codes must be rejected from the direct route"
)

let morocco = catalog.entries.first { $0.id == "morocco-ministry-of-justice" }!
let moroccoFields = ApostilleParser.extractFields(for: morocco, from: recognition)
let moroccoValues = Dictionary(uniqueKeysWithValues: moroccoFields.map { ($0.label, $0.value) })
expect(moroccoValues["Apostille Number"] == "UA-123456", "generic Apostille number may use standard item 8")
expect(moroccoValues["Signature Date"] == "", "item 6 must not be copied into a signature date")
expect(moroccoValues["Signature date of the underlying document"] == "", "item 6 must not be copied into the source-document date")

let multilingualRecognition = RecognitionResult(lines: [
    line("APOSTILLE / APOSTILLA"),
    line("1. Pays / País: Ukraine"),
    line("6. Fecha / Date : 18 juillet 2026"),
    line("7. Par / Por: Ministry of Education and Science"),
    line("8. Numéro / Número: UA-778899"),
    line("9. Sceau / Sello"),
    line("10. Signature / Firma")
])
let multilingualFields = ApostilleParser.extractFields(for: ukraine, from: multilingualRecognition)
let multilingualValues = Dictionary(uniqueKeysWithValues: multilingualFields.map { ($0.id, $0.value) })
expect(multilingualValues["apostilleNumber"] == "UA-778899", "multilingual item 8 labels must be removed")
expect(multilingualValues["apostilleDate"] == "18.07.2026", "French month names must normalize for the verifier")
expect(multilingualFields.first(where: { $0.id == "apostilleDate" })?.isoDate == "2026-07-18", "localized dates must carry an ISO browser-fill value")

var correctedFields = multilingualFields
let correctedDateIndex = correctedFields.firstIndex { $0.id == "apostilleDate" }!
correctedFields[correctedDateIndex].value = "29.08.2026"
let reviewedFields = ApostilleParser.refreshingDateMetadata(in: correctedFields, for: ukraine)
expect(
    reviewedFields.first(where: { $0.id == "apostilleDate" })?.isoDate == "2026-08-29",
    "a reviewed date must replace its original OCR-derived ISO browser-fill value"
)
expect(
    ApostilleParser.isoDate(from: "04/05/2026") == nil,
    "an ambiguous numeric date must not receive a guessed day-first ISO value"
)
expect(
    ApostilleParser.isoDate(from: "13/05/2026") == "2026-05-13",
    "an unambiguous numeric date may still receive an ISO value"
)
let ukraineDateField = ukraine.verification!.fields.first { $0.id == "apostilleDate" }!
expect(
    FieldValidator.error(for: ukraineDateField, value: "29/08/2026") != nil,
    "a dotted date field must reject slash separators"
)
expect(
    FieldValidator.error(for: ukraineDateField, value: "29.08.2026") == nil,
    "a valid dotted calendar date must be accepted"
)
expect(
    FieldValidator.error(for: ukraineDateField, value: "31.02.2026") != nil,
    "a correctly shaped but impossible calendar date must be rejected"
)
var authorityOrderedFields = multilingualFields
authorityOrderedFields[correctedDateIndex].value = "04.05.2026"
expect(
    ApostilleParser.refreshingDateMetadata(in: authorityOrderedFields, for: ukraine)
        .first(where: { $0.id == "apostilleDate" })?.isoDate == "2026-05-04",
    "an authority's explicit dotted DD.MM.YYYY format may resolve an otherwise ambiguous date"
)

let ukraineHostPolicy = OfficialHostPolicy(entry: ukraine, initialURL: ukraine.registerUrl)
expect(
    ukraineHostPolicy.permitsMainFrameNavigation(to: URL(string: "https://enic.in.ua/index.php/en/aporegen")!),
    "the authority's exact official host must remain in-app"
)
expect(
    !ukraineHostPolicy.permitsMainFrameNavigation(to: URL(string: "https://enic.in.ua.attacker.example/phishing")!),
    "a hostname that only starts with an official hostname must be blocked"
)
expect(
    !ukraineHostPolicy.permitsMainFrameNavigation(to: URL(string: "https://attacker.example/")!),
    "unapproved HTTPS hosts must not inherit official in-app branding"
)
expect(
    !ukraineHostPolicy.permitsMainFrameNavigation(to: URL(string: "http://enic.in.ua/index.php/en/aporegen")!),
    "even an approved authority host must not receive in-app branding over HTTP"
)
let insecureEntry = catalog.entries.first { $0.registerUrl?.scheme?.lowercased() == "http" }!
switch VerificationRouter.route(for: insecureEntry, values: ["certificate": "SECRET-123"]) {
case .externalInsecure(let url):
    expect(!url.absoluteString.contains("SECRET-123"), "HTTP routes must not contain reviewed certificate values")
default:
    expect(false, "an HTTP-only authority must be routed outside the branded verifier")
}
// Spelled out rather than built from a mixed optional/non-optional array
// literal: Swift 6.2 and 6.3 infer that expression differently, and the 6.3
// reading left the element type as URL? and stopped compiling.
let catalogURLs: [URL] = catalog.entries.flatMap { entry -> [URL] in
    var urls: [URL] = entry.registerLinks.map(\.url)
    if let registerUrl = entry.registerUrl { urls.append(registerUrl) }
    if let deepLinkUrl = entry.verification?.deepLink?.url { urls.append(deepLinkUrl) }
    return urls
}
for url in catalogURLs where url.scheme?.lowercased() == "http" {
    if case .externalInsecure = VerificationRouter.route(to: url) {
        // Expected: no catalog HTTP URL may enter WebVerifierView.
    } else {
        expect(false, "catalog HTTP URL must be external-only: \(url.absoluteString)")
    }
}

let china = catalog.entries.first { $0.id == "china-china-mainland-ministry-of-foreign-affairs" }!
let chinaRecognition = RecognitionResult(lines: [
    line("贴纸编号: E11223344"),
    line("1. Country / 国家: China"),
    line("6. Date / 日期: 2026年8月28日"),
    line("8. No. / 编号: 250000000001"),
    line("9. Seal / Stamp"),
    line("10. Signature")
])
let chinaFields = ApostilleParser.extractFields(for: china, from: chinaRecognition)
let chinaValues = Dictionary(uniqueKeysWithValues: chinaFields.map { ($0.id, $0.value) })
expect(chinaValues["apostilleNumber"] == "250000000001", "China's standard Apostille number must come from item 8")
expect(chinaValues["stickerNumber"] == "E11223344", "China's labeled sticker number must use authority metadata")

let chinaOfficialLayoutRecognition = RecognitionResult(lines: [
    line("E00268460"),
    line("1. 文书出具国:"),
    line("People's Republic of China"),
    line("6. 签发日期"),
    line("2025年04月17日"),
    line("8. 附加证明书编号"),
    line("认字第250000149018号"),
    line("9. 签发机关印鉴"),
    line("10. 签名")
])
let chinaOfficialFields = ApostilleParser.extractFields(for: china, from: chinaOfficialLayoutRecognition)
let chinaOfficialValues = Dictionary(uniqueKeysWithValues: chinaOfficialFields.map { ($0.id, $0.value) })
expect(chinaOfficialValues["apostilleNumber"]?.contains("250000149018") == true, "a split Chinese item 8 label must not replace its following value")
expect(chinaOfficialValues["stickerNumber"] == "E00268460", "an unlabeled barcode sticker number must be found by its authority-specific pattern")

let chineseCountryRecognition = RecognitionResult(lines: [line("1. 国家：中国")])
expect(AuthorityMatcher(entries: catalog.entries).matches(for: chineseCountryRecognition).first?.entry.country == "China", "localized country names must participate in authority matching")

let singapore = catalog.entries.first { $0.id == "singapore-singapore-academy-of-law" }!
let singaporeRecognition = RecognitionResult(lines: [
    line("1. Country: Singapore"),
    line("5. At: Singapore Academy of Law"),
    line("6. The: 28th Aug 2024"),
    line("8. No.: AC0O6P004A")
])
let singaporeFields = ApostilleParser.extractFields(for: singapore, from: singaporeRecognition)
let singaporeValues = Dictionary(uniqueKeysWithValues: singaporeFields.map { ($0.id, $0.value) })
expect(
    singaporeValues["apostilleCertificateNumber"] == "AC006P004A",
    "a structured non-standard identifier must correct OCR letter/digit ambiguity from its authority mask"
)

let chile = catalog.entries.first { $0.id.hasPrefix("chile-relevant-authorities") }!
let chileFields = ApostilleParser.extractFields(for: chile, from: RecognitionResult(lines: [line("CAPTCHA code shown on page: 1234")]))
let captcha = chileFields.first { $0.label.localizedCaseInsensitiveContains("CAPTCHA") }
expect(captcha?.captureSource == .portal && captcha?.value.isEmpty == true, "portal CAPTCHA values must never be extracted from the Apostille")

let bahrainPayload = "www.mofa.gov.bh/legalization?id=000000"
let bahrainMatch = QrRouter.match(bahrainPayload, entries: catalog.entries)
expect(bahrainMatch?.entry.id == "bahrain-ministry-of-foreign-affairs", "a schemeless specimen-matching QR must route before OCR")
expect(bahrainMatch?.destination.scheme == "https", "the documented Bahrain QR must normalize to HTTPS")

let pakistanPayload = "https://apostille.mofa.gov.pk/verify-attestation-by-qr?apostille_number=APO-1234&day=28&month=08&year=2026"
expect(QrRouter.match(pakistanPayload, entries: catalog.entries)?.entry.id == "pakistan-ministry-of-foreign-affairs", "Pakistan's documented QR shape must route")
expect(QrRouter.match("https://apostille.mofa.gov.pk/verify-attestation-by-qr?apostille_number=APO-1234&next=https://evil.example", entries: catalog.entries) == nil, "unexpected QR redirect parameters must be blocked")
let pakistanDefaultPortPayload = pakistanPayload.replacingOccurrences(of: "gov.pk/", with: "gov.pk:443/")
expect(QrRouter.match(pakistanDefaultPortPayload, entries: catalog.entries)?.entry.id == "pakistan-ministry-of-foreign-affairs", "a redundant default port must route exactly as the web engine's WHATWG parse does")
expect(QrRouter.match(pakistanPayload.replacingOccurrences(of: "gov.pk/", with: "gov.pk:8443/"), entries: catalog.entries) == nil, "a non-default port is still not the allowlisted endpoint")

let chinaQrPayload = "https://consular.mfa.gov.cn/VERIFY/#/ABCDEFGHIJKL?content=250000000001&paperNo=E00000001&checkCode=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
expect(QrRouter.match(chinaQrPayload, entries: catalog.entries)?.entry.id == "china-china-mainland-ministry-of-foreign-affairs", "China's authority-published HTTPS fragment shape must route")
expect(QrRouter.match(chinaQrPayload.replacingOccurrences(of: "https:", with: "http:"), entries: catalog.entries) == nil, "China's superseded HTTP route must be rejected")
expect(QrRouter.match("https://consular.mfa.gov.cn/VERIFY/#/ABCDEFGHIJKL?content=250000000001&paperNo=E00000001&next=https://evil.example", entries: catalog.entries) == nil, "China's QR fragment must reject unexpected fields")
// A provincial Foreign Affairs Office prints a plain barcode rather than the
// MFA sticker, so its QR carries no paperNo at all.
let chinaNoPaperNo = "https://consular.mfa.gov.cn/VERIFY/#/ABCDEFGHIJKL?content=250000000001&checkCode=AAAAAAAAAAAAAAAAAAAAAAAA"
expect(QrRouter.match(chinaNoPaperNo, entries: catalog.entries)?.entry.id == "china-china-mainland-ministry-of-foreign-affairs", "a Chinese QR without the optional paperNo must still route")
expect(QrRouter.match(chinaNoPaperNo + "&next=https://evil.example", entries: catalog.entries) == nil, "making paperNo optional must not admit extra fragment fields")
expect(QrRouter.match(chinaNoPaperNo.replacingOccurrences(of: "content=250000000001", with: "content=25000000000"), entries: catalog.entries) == nil, "the twelve-digit reference shape is still required")

// A provincially issued certificate wraps item 8 in a Chinese document-class
// prefix and suffix and carries no E-prefixed sticker at all. The verifier
// takes the twelve digits alone, which is also what the QR's `content` carries.
let chinaProvincialRecognition = RecognitionResult(lines: [
    "附加证明书  APOSTILLE",
    "（1961年10月5日海牙公约）",
    "1. 文书出具国: 中华人民共和国",
    "6. 签发日期 2026年06月29日",
    "7. 签发人 江西省外事办公室",
    "8. 附加证明书编号  认字第250000000001号",
    "10. 签名"
].map { line($0) })
let chinaProvincialFields = ApostilleParser.extractFields(for: china, from: chinaProvincialRecognition)
expect(
    chinaProvincialFields.first(where: { $0.id == "apostilleNumber" })?.value == "250000000001",
    "China's Apostille number must be narrowed to the digits its verifier accepts"
)
expect(
    chinaProvincialFields.first(where: { $0.id == "stickerNumber" })?.value.isEmpty == true,
    "a certificate with no E-prefixed sticker must leave the sticker number for the user"
)

// --- template-label and block-segmentation regressions -----------------------
//
// These build the recognition result directly instead of going through Vision,
// so a parser regression fails here deterministically on every machine. The
// OCR suite covers the same ground through real recognition where the script
// is one Vision supports.

func items(_ texts: [String]) -> [Int: String] {
    ApostilleParser.numberedItems(in: texts.map { line($0) })
}

func placed(_ text: String, x: Double, y: Double, width: Double, height: Double) -> RecognizedLine {
    RecognizedLine(
        text: text,
        confidence: 0.95,
        bounds: NormalizedRect(x: x, y: y, width: width, height: height)
    )
}

// A template label is only a label at the start of the value. Stripping every
// occurrence used to gut real values that contain the same words.
expect(items(["5. at: Aix-en-Provence"])[5] == "Aix-en-Provence", "a French place name must survive item 5 label stripping")
expect(items(["5. in: Berlin in Germany"])[5] == "Berlin in Germany", "an interior 'in' must not be stripped from item 5")
expect(items(["5. at: La Paz"])[5] == "La Paz", "a place name that starts with an article must not be truncated")
expect(items(["7. by: Tribunal de Justica da Bahia"])[7] == "Tribunal de Justica da Bahia", "a Portuguese authority particle must survive item 7 label stripping")
expect(items(["4. bears the seal or stamp of: Royal Seal Office"])[4] == "Royal Seal Office", "the item 4 template phrase must be removed whole, not word by word")
expect(items(["4. bears the seal / stamp of: Example Office"])[4] == "Example Office", "the slash-separated item 4 phrase must also be removed whole")
expect(items(["8. No: NO-123456"])[8] == "NO-123456", "an Apostille number whose prefix reads like a label must not be truncated")
expect(items(["1. Country / Pays / País: United Kingdom"])[1] == "United Kingdom", "a chained multilingual label must still be stripped to the value")

// A slash chains the languages and a colon ends the label group. The last
// label in a chain is followed only by whitespace before the value, so the
// continuation rule has to read the separator *before* a label, not after it.
expect(items(["6. the / le  2026-06-19"])[6] == "2026-06-19", "the final label in a bilingual chain must be stripped from the value")
expect(items(["1. Country: / Pays : Canada"])[1] == "Canada", "a chain that also punctuates each label must strip to the value")
expect(items(["7. por: Da Costa Office"])[7] == "Da Costa Office", "a value after a colon is not a chained label, even when it starts with one")
expect(items(["8. N° / sous n°"])[8] == nil, "an item 8 line holding only labels must not become the number")
expect(items(["8. N° / sous n°  ON-26-000000-0000"])[8] == "ON-26-000000-0000", "a degree-sign number label must be stripped despite having no word boundary after it")
expect(items(["8. No / sous no / bajo el número: UK-260042"])[8] == "UK-260042", "the trilingual number label must strip in all three languages")

// The model's connective phrases sit between the numbered items and belong to
// none of them, but they follow one, so they used to be absorbed as its value.
expect(
    items(["1. Country: / Pays :  Canada", "This public document / Le présent acte public"])[1] == "Canada",
    "a model connective line must not be absorbed as the value of the item above it"
)
expect(
    items(["5. at / à  Toronto, Ontario", "Certified / Attesté"])[5] == "Toronto, Ontario",
    "the certified-line boilerplate must not become item 5"
)
expect(
    items(["4. bears the seal or stamp of: Certified Copies Office"])[4] == "Certified Copies Office",
    "a value that merely contains a connective word is still a value"
)
expect(items(["8. رقم / No: PK-AR-884422"])[8] == "PK-AR-884422", "a right-to-left label printed after the value must be stripped")

// Only right-to-left lines put the item number last. Accepting that shape for
// Latin text let ordinary sentences open a bogus block and swallow the rest.
let strayDigitScan = [
    "1. Country: United Kingdom",
    "5. at: London",
    "6. dated: 28 August 2026",
    "7. by: Legalisation Office",
    "8. No: UK-889900",
    "Registered under file ref A-5",
    "This certificate only attests the signature."
]
expect(items(strayDigitScan)[5] == "London", "a line ending in 'ref A-5' must not hijack item 5")
expect(items(strayDigitScan)[8] == "UK-889900", "trailing narrative must not outscore the real item 8 reference")
expect(items(["نسخة .5", "6. dated: 28 August 2026"])[5] == "نسخة", "a genuine right-to-left trailing item number still opens its block")

// Label vocabularies for register languages that previously went unparsed.
expect(items(["6. Ημερομηνία: 18 Ιουλίου 2026", "8. Αριθμός: CY-4471"])[8] == "CY-4471", "Greek item 8 labels must be stripped")
expect(items(["6. Tarih: 18 Temmuz 2026", "8. Numara: TR-9910"])[8] == "TR-9910", "Turkish item 8 labels must be stripped")
expect(items(["8. onder nr.: NL-7742"])[8] == "NL-7742", "the Dutch item 8 label must be stripped whole")
expect(items(["8. Numarul: RO-2291"])[8] == "RO-2291", "Romanian item 8 labels must be stripped")
expect(items(["6. il: 18 luglio 2026"])[6] == "18 luglio 2026", "the Italian item 6 label must be stripped")
expect(ApostilleParser.isoDate(from: "18 Ιουλίου 2026") == "2026-07-18", "Greek month names must resolve to an ISO date")
expect(ApostilleParser.isoDate(from: "18 Temmuz 2026") == "2026-07-18", "Turkish month names must resolve to an ISO date")
expect(ApostilleParser.isoDate(from: "18 iulie 2026") == "2026-07-18", "Romanian month names must resolve to an ISO date")
expect(ApostilleParser.isoDate(from: "18 юли 2026") == "2026-07-18", "Bulgarian month names must resolve to an ISO date")

// Two-column certificates print the value in a different column from its
// numbered label. OCR reading order then pairs each block with the *next*
// item's value, so item 8's block holds nothing but "Nº / sous n°" and the
// number has to be found by where it sits, not by what followed it.
// Geometry below is measured from a real Ontario certificate.
let ontario = catalog.entries.first {
    $0.id == "canada-ministry-of-public-and-business-service-delivery-and-procurement-of-the-province-of-ontario"
}!
let twoColumnScan = RecognitionResult(lines: [
    placed("6. the / le", x: 0.686, y: 0.425, width: 0.080, height: 0.019),
    placed("2026-06-19", x: 0.780, y: 0.425, width: 0.086, height: 0.019),
    placed("Manager Official Documents Services", x: 0.451, y: 0.400, width: 0.288, height: 0.020),
    placed("7. by / par", x: 0.134, y: 0.386, width: 0.070, height: 0.014),
    placed("ON-26-506237-8785", x: 0.449, y: 0.367, width: 0.152, height: 0.017),
    placed("8. Nº / sous n°", x: 0.134, y: 0.354, width: 0.101, height: 0.014),
    placed("10. Signature / Signature :", x: 0.134, y: 0.330, width: 0.150, height: 0.014),
    placed("9. Seal / stamp / Sceau / timbre :", x: 0.134, y: 0.310, width: 0.170, height: 0.014),
    // The signature is one tall box spanning several rows, further right than
    // the number and closer to item 8's row midpoint than the number is.
    placed("Kent Litt", x: 0.660, y: 0.299, width: 0.236, height: 0.072)
])
let twoColumnFields = ApostilleParser.extractFields(for: ontario, from: twoColumnScan)
expect(
    twoColumnFields.first(where: { $0.id == "field-0" })?.value == "ON-26-506237-8785",
    "a number printed beside its own numbered label must be found when line order does not pair them"
)
expect(
    twoColumnFields.first(where: { $0.id == "field-1" })?.isoDate == "2026-06-19",
    "the date must still come from its own item 8 neighbour rather than the spatial fallback"
)

// Geometry may order suggestions, but it must not silently decide between two
// reference-shaped strings. The closer value is deliberately the wrong one.
let ambiguousReferenceScan = RecognitionResult(lines: [
    placed("ON-26-111111-2222", x: 0.25, y: 0.405, width: 0.16, height: 0.016),
    placed("8. Nº / sous n°", x: 0.10, y: 0.400, width: 0.11, height: 0.014),
    placed("ON-26-506237-8785", x: 0.45, y: 0.365, width: 0.16, height: 0.016)
])
let ambiguousReference = ApostilleParser.extractFields(for: ontario, from: ambiguousReferenceScan)
    .first { $0.id == "field-0" }!
expect(ambiguousReference.value.isEmpty, "geometry alone must not prefill one of two plausible references")
expect(ambiguousReference.needsCandidateSelection, "ambiguous references must require an explicit user selection")
expect(
    Set(ambiguousReference.suggestedValues) == Set(["ON-26-111111-2222", "ON-26-506237-8785"]),
    "both plausible references must be offered for review"
)

let ambiguousDateScan = RecognitionResult(lines: [
    placed("6. the / le", x: 0.10, y: 0.45, width: 0.10, height: 0.014),
    placed("2026-06-19", x: 0.45, y: 0.43, width: 0.10, height: 0.016),
    placed("Underlying document date: 2024-01-03", x: 0.10, y: 0.30, width: 0.35, height: 0.016)
])
let ambiguousDate = ApostilleParser.extractFields(for: ontario, from: ambiguousDateScan)
    .first { $0.id == "field-1" }!
expect(ambiguousDate.value.isEmpty, "two plausible dates must not be assigned from proximity")
expect(
    Set(ambiguousDate.suggestedValues) == Set(["2026-06-19", "2024-01-03"]),
    "ambiguous dates must be presented as review choices; got \(ambiguousDate.suggestedValues)"
)

// The fallback must not second-guess a certificate that prints the value inline.
let inlineScan = RecognitionResult(lines: [
    placed("8. No: UK-889900", x: 0.10, y: 0.50, width: 0.20, height: 0.014),
    placed("Rejected neighbour", x: 0.60, y: 0.50, width: 0.20, height: 0.014)
])
expect(
    ApostilleParser.extractFields(for: ukraine, from: inlineScan)
        .first(where: { $0.id == "apostilleNumber" })?.value == "UK-889900",
    "an item that carries its own value must ignore whatever sits beside it"
)

// Every Apostille reprints "Convention de La Haye du 5 octobre 1961". That date
// must never be offered as the date the certificate was issued.
let noItemSix = RecognitionResult(lines: [
    "APOSTILLE",
    "(Convention de La Haye du 5 octobre 1961)",
    "1. Country: Ukraine",
    "7. by: Ministry of Education and Science",
    "8. No. UA-123456"
].map { line($0) })
let noItemSixFields = ApostilleParser.extractFields(for: ukraine, from: noItemSix)
let noItemSixDate = noItemSixFields.first { $0.id == "apostilleDate" }
expect(noItemSixDate?.value.isEmpty == true, "the Convention's own 1961 date must never fill in for a missing item 6")
expect(noItemSixDate?.isoDate == nil, "an unfilled date must not carry a browser-fill value")
expect(
    noItemSixFields.first(where: { $0.id == "apostilleNumber" })?.value == "UA-123456",
    "suppressing the Convention date must not disturb the other extracted fields"
)
let pakistan = catalog.entries.first { $0.id == "pakistan-ministry-of-foreign-affairs" }!
let arabicConvention = RecognitionResult(lines: [
    "APOSTILLE",
    "(اتفاقية لاهاي المؤرخة في ٥ أكتوبر ١٩٦١)",
    "1. الدولة / Country: Pakistan",
    "8. رقم / No: PK-AR-884422"
].map { line($0) })
let arabicConventionFields = ApostilleParser.extractFields(for: pakistan, from: arabicConvention)
expect(
    arabicConventionFields.first(where: { $0.id == "field-1" })?.value.isEmpty == true,
    "the Convention reference in Arabic-Indic digits must not fill in for a missing item 6"
)
expect(
    arabicConventionFields.first(where: { $0.id == "field-0" })?.value == "PK-AR-884422",
    "suppressing the Arabic Convention line must not disturb item 8"
)

let conventionAndRealDate = RecognitionResult(lines: [
    "APOSTILLE (Convention de La Haye du 5 octobre 1961)",
    "1. Country: Ukraine",
    "Issued 28 August 2026",
    "8. No. UA-123456"
].map { line($0) })
expect(
    ApostilleParser.extractFields(for: ukraine, from: conventionAndRealDate)
        .first(where: { $0.id == "apostilleDate" })?.value == "28.08.2026",
    "an unlabeled date elsewhere on the certificate is still a usable fallback"
)

print("Apositify iOS core tests passed")

// MARK: - Regressions found by sweeping the whole specimen corpus
//
// Every case below is the OCR text a real specimen actually produced, on an
// iPhone or a Pixel, reduced to the lines that mattered.

func fields(_ authorityId: String, _ texts: [String]) -> [ExtractedField] {
    let entry = catalog.entries.first { $0.id == authorityId }!
    return ApostilleParser.extractFields(for: entry, from: RecognitionResult(lines: texts.map { line($0) }))
}

func field(_ authorityId: String, _ id: String, _ texts: [String]) -> ExtractedField {
    fields(authorityId, texts).first { $0.id == id }!
}

// A Xiaohongshu watermark across the top of a photographed Japanese Apostille
// put three reference-shaped strings above the certificate number. The review
// shortlist was trimmed before the item resolver's own choice was ranked into
// it, so the printed number was dropped from the suggestions altogether.
let japanNumber = field("japan-ministry-of-foreign-affairs", "field-0", [
    "13小红薯69F7FF90",
    "令和8年 7",
    "東京都千代田区丸の内三丁目3番1号",
    "8. No.",
    "26028925"
])
expect(
    japanNumber.suggestedValues.first == "26028925",
    "the printed certificate number must lead the review shortlist, not be trimmed out of it"
)

// Japan prints its issue date as "Jul. 10.2026" — no space before the year.
let japanDate = field("japan-ministry-of-foreign-affairs", "field-1", [
    "6.", "Jul. 10.2026", "8. No.", "26028925"
])
expect(japanDate.isoDate == "2026-07-10", "a month name joined to its year by a period must still parse")

// Costa Rica is the one authority whose field must submit ISO, so 12/07/2019
// genuinely has to be interpreted. Costa Rica writes dates day-first, and
// nothing on the page contradicts that, so it resolves rather than asking.
let costaRicaDate = field("costa-rica-ministry-of-foreign-affairs-and-worship", "apostilleDate", [
    "1. País: Costa Rica", "6. El: 12/07/2019", "8. No.: 589210"
])
expect(costaRicaDate.value == "2019-07-12", "a day-first country resolves its own numeric date, got '\(costaRicaDate.value)'")

// Where both orders are in everyday use the country says nothing, and a field
// that must submit ISO cannot invent an answer. Israel is one of the three.
let israelDate = field("israel-ministry-of-justice", "field-1", [
    "1. Country: Israel", "6. the 12/07/2019"
])
expect(
    israelDate.value == "12/07/2019",
    "a field that submits the printed text needs the date read, not interpreted, got '\(israelDate.value)'"
)

// Costa Rica's verifier wants the code printed at the top right, which is not
// item 8. Its label is Spanish, so an English-only alias never found it.
let costaRicaCode = field("costa-rica-ministry-of-foreign-affairs-and-worship", "apostilleCode", [
    "Código: NCDXATKNWGC", "(Code – Code:)", "8. No.: 589210"
])
expect(costaRicaCode.value == "NCDXATKNWGC", "a Spanish-labelled apostille code must be extracted")

// Chile prints "Fecha Emisión [ 28-10-2016 ]". The brackets and the repeated
// label are not part of what its verifier accepts.
let chileDate = field(
    "chile-relevant-authorities-of-the-ministries-of-justice-education-health-foreign-affairs-and-the-civil-and-identification-registration-service",
    "field-1",
    ["1. País", "CHILE", "Número Apostilla [ EAC42604 ]", "Fecha Emisión [ 28-10-2016 ]"]
)
expect(chileDate.value == "28-10-2016", "a labelled date must be narrowed to the date itself, got '\(chileDate.value)'")

// Chile labels item 8 in Spanish. With no standard item the printed number
// could never reach the field at all.
let chileNumber = field(
    "chile-relevant-authorities-of-the-ministries-of-justice-education-health-foreign-affairs-and-the-civil-and-identification-registration-service",
    "field-0",
    ["8. Bajo el número", "EAC42604", "Ley N° 19.799", "Ley N° 20.711"]
)
expect(
    chileNumber.value == "EAC42604" || chileNumber.suggestedValues.first == "EAC42604",
    "a Spanish-labelled apostille number must reach its field, got '\(chileNumber.value)' \(chileNumber.suggestedValues)"
)

// A legalisation sticker prints a fee beside the reference. "GBP40.00" is
// shaped like a reference and was confirmed as the certificate number.
let ukNumber = field("united-kingdom-foreign-and-commonwealth-office", "field-1", [
    "8. Number", "APO-: XXXXXXXXXXX", "Price: GBP40.00"
])
expect(ukNumber.value != "GBP40.00", "a currency amount must never be submitted as a certificate number")

// Hong Kong's Year field took the next word out of "…in the Year Two Thousand
// and Twenty-six", and its Reference Code took a fragment of Japanese.
let hongKongYear = field(
    "china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court",
    "field-1",
    ["affixed my Seal of Office this 12th", "day of February in the Year Two", "Thousand and Twenty-six."]
)
expect(hongKongYear.value.isEmpty, "a Year field must not be filled with the word after the label, got '\(hongKongYear.value)'")

func topAuthority(_ texts: [String]) -> RegisterEntry? {
    AuthorityMatcher(entries: catalog.entries)
        .matches(for: RecognitionResult(lines: texts.map { line($0) }))
        .first?.entry
}

// "United Kingdom of Great Britain and Northern Ireland" names one country.
// Reading "Ireland" out of it put every UK Apostille under the wrong state.
let unitedKingdom = topAuthority([
    "1. Country:",
    "United Kingdom of Great Britain and Northern Ireland",
    "7. by Her Majesty's Principal Secretary of State for",
    "Foreign, Commonwealth and Development Affairs",
    "By: Legalisation Office (Foreign, Commonwealth & Development Office)"
])
expect(
    unitedKingdom?.country == "United Kingdom",
    "Northern Ireland must not be read as Ireland, got \(unitedKingdom?.country ?? "none")"
)

// Russia prints its own name in Cyrillic and nothing matched it.
let russia = topAuthority([
    "1. Страна:", "Российская Федерация", "6. Дата 29.02.2024",
    "7. учреждение Начальник отдела международной правовой помощи и проставления апостиля"
])
expect(
    russia?.country == "Russian Federation",
    "the Russian Federation must match its own printed name, got \(russia?.country ?? "none")"
)

// An Apostille prints its country as a field value. A Hong Kong certificate
// whose attached notarial page mentioned exporting goods "to India" was read
// as an Indian Apostille.
let hongKong = topAuthority([
    "1. Letter of Consent for Importing Carbendazim Technical 98 % w/w min to India",
    "1. Country: Hong Kong, China",
    "5. at High Court",
    "7. by Simon KWANG Registrar, High Court"
])
expect(
    hongKong?.id == "china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court",
    "a country named inside a sentence must not outrank the country field, got \(hongKong?.id ?? "none")"
)

// Brazil's Code field was filled with "(Codet" — Vision's reading of the
// printed "(Code)" label beneath it.
let brazilCode = field("brazil-national-council-of-justice", "field-0", [
    "9. Selo / Carimbo", "(Code)", "(Codet"
])
expect(brazilCode.value.isEmpty, "a value that only repeats its own label must be rejected, got '\(brazilCode.value)'")

// The certificate's own declared order outranks any assumption from the
// country it was issued in. Washington State prints "(MM-DD-YYYY)" in the
// field label, so 05/09/2022 is 9 May, not 5 September.
let washington = field("united-states-of-america-washington-secretary-of-state", "field-0", [
    "1. Country: United States of America", "6. Date Printed 05/09/2022"
])
expect(washington.isoDate == "2022-05-09", "a label-declared order must be honoured, got \(washington.isoDate ?? "none")")

// Azerbaijan declares day-first in its label, against the same printed digits.
let azerbaijan = field("azerbaijan-ministry-of-justice", "field-1", [
    "1. Country: Azerbaijan", "6. Date 05/09/2022"
])
expect(azerbaijan.isoDate == "2022-09-05", "a day-first label must be honoured, got \(azerbaijan.isoDate ?? "none")")

// One page is printed by one authority in one order, so a date elsewhere on it
// whose day exceeds 12 settles how to read the ambiguous one. Here the page
// evidence contradicts the country default and must win.
let pageEvidence = field("united-states-of-america-california-secretary-of-state", "field-1", [
    "1. Country: United States of America",
    "Signed on 25/12/2021",
    "6. Issue Date: 05/09/2022"
])
expect(
    pageEvidence.isoDate == "2022-09-05",
    "an unambiguous date on the same page must set the order, got \(pageEvidence.isoDate ?? "none")"
)

// An ambiguous numeric date is still a date. It must never be offered as a
// certificate number just because it could not be interpreted.
let numberBesideDate = field("israel-ministry-of-justice", "field-0", [
    "6. the 12/07/2019", "8. No. IL-4471-22"
])
expect(
    !numberBesideDate.suggestedValues.contains("12/07/2019") && numberBesideDate.value != "12/07/2019",
    "a date must never be offered as a certificate number, got '\(numberBesideDate.value)' \(numberBesideDate.suggestedValues)"
)
