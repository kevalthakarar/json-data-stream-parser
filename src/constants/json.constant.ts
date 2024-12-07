export enum ParserStates {
	VALUE = 1,
	KEY = 2,
	COLON = 3,
	COMMA = 4,
}

export enum ParserMode {
	OBJECT = 1, // if value if object
	ARRAY = 2, // if value is array
}

export enum ParserToken {
	LEFT_BRACE = "{".charCodeAt(0),
	RIGHT_BRACE = "}".charCodeAt(0),
	LEFT_BRACKET = "[".charCodeAt(0),
	RIGHT_BRACKET = "]".charCodeAt(0),
	COLON = ":".charCodeAt(0),
	COMMA = ",".charCodeAt(0),
	TRUE = "t".charCodeAt(0),
	FALSE = "f".charCodeAt(0),
	NULL = "n".charCodeAt(0),
	STRING = '"'.charCodeAt(0),
	NEGATIVE_NUMBER = "-".charCodeAt(0),
	ZERO = "0".charCodeAt(0),
	NINE = "9".charCodeAt(0),
	EMPTY_SPACE = " ".charCodeAt(0),
	NEW_LINE = "\n".charCodeAt(0),
	TAB = "\t".charCodeAt(0),
	CARRIAGE_RETURN = "\r".charCodeAt(0),
}

export enum TokenStates {
	START = 1,
	STOP = 2,

	TRUE1 = 3, // t
	TRUE2 = 4, // r
	TRUE3 = 5, // u

	FALSE1 = 7, // f
	FALSE2 = 8, // a
	FALSE3 = 9, // l
	FALSE4 = 10, // s

	NULL1 = 11, // n
	NULL2 = 12, // u
	NULL3 = 13, // l

	NUMBER1 = 14, // negative
	NUMBER2 = 15, // positive

	STRING1 = 16, // normal string (including multi byte char)
	STRING2 = 17, // back slash for \n, \t..
	STRING3 = 18, // Unicode formatting
	STRING4 = 19, // UTF-16 2nd
	STRING5 = 20, // UTF-16 3rd
	STRING6 = 21, // UTF-16 4th  completion of one unit code
}

export enum ParserSpecialChars {
	BACK_SLASH = "\\".charCodeAt(0),
	FORWARD_SLASH = "/".charCodeAt(0),
	BACKSPACE = "b".charCodeAt(0),
	FORM_FEED = "f".charCodeAt(0),
	NEW_LINE = "n".charCodeAt(0),
	CARRIAGE_RETURN = "r".charCodeAt(0),
	TAB = "t".charCodeAt(0),
	UNI_CODE = "u".charCodeAt(0),
	ZERO = "0".charCodeAt(0),
	NINE = "9".charCodeAt(0),
	A = "A".charCodeAt(0),
	Z = "Z".charCodeAt(0),
	a = "a".charCodeAt(0),
	z = "z".charCodeAt(0),
}

export const STRING_BUFFER_SIZE = 64 * 1024; //64 KB
