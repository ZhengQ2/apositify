import Foundation

enum FieldValidator {
    static func error(for field: VerificationField, value: String) -> String? {
        let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return "Required" }

        switch field.format {
        case "date-iso":
            guard isDate(value, format: "yyyy-MM-dd", pattern: #"^\d{4}-\d{2}-\d{2}$"#) else { return "Use YYYY-MM-DD" }
        case "date-dotted":
            guard isDate(value, format: "dd.MM.yyyy", pattern: #"^\d{2}\.\d{2}\.\d{4}$"#) else { return "Use DD.MM.YYYY" }
        case "non-arij-apostille-code":
            if value.lowercased().hasPrefix("arij") {
                return "ARIJ codes use Moldova’s separate MPass service"
            }
        default:
            break
        }
        return nil
    }

    private static func isDate(_ value: String, format: String, pattern: String) -> Bool {
        guard value.range(of: pattern, options: .regularExpression) != nil else { return false }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = format
        formatter.isLenient = false
        guard let date = formatter.date(from: value) else { return false }
        return formatter.string(from: date) == value
    }
}
