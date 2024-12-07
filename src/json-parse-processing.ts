import {
	TokenStates,
	ParserToken,
	ParserStates,
	ParserMode,
	ParserSpecialChars,
	STRING_BUFFER_SIZE,
} from "./constants/index";

export class JSONParseProcessing {
	private tState: TokenStates;
	key: string | number | undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private value: any;
	private string: string | undefined;
	private stringBuffer: Buffer;
	private stringBufferOffset: number;
	private unicode: string | undefined;
	private highSurrogate: number | undefined;
	private mode: ParserMode;
	stack: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		value: any;
		key: string | number | undefined;
		mode: ParserMode;
	}[];
	private state: ParserStates;

	private bytes_remaining: number; // number of bytes remaining in multi byte utf8 char to read after split boundary

	private bytes_in_sequence: number; // bytes in multi byte utf8 char to read

	private temp_buffs: { [key: string]: Buffer }; // for rebuilding chars split before boundary is reached

	private offset: number; // stream offset

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private onValue: (value: any) => void;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(onValue: (value: any) => void) {
		this.tState = TokenStates.START;
		this.value = undefined;
		this.stringBuffer = Buffer.alloc(STRING_BUFFER_SIZE);
		this.stringBufferOffset = 0;
		this.highSurrogate = undefined;
		this.mode = ParserMode.OBJECT;
		this.stack = [];
		this.state = ParserStates.VALUE;
		this.bytes_remaining = 0;
		this.bytes_in_sequence = 0;
		this.temp_buffs = {
			"2": Buffer.alloc(2),
			"3": Buffer.alloc(3),
			"4": Buffer.alloc(4),
		};
		this.offset = -1;
		this.onValue = onValue;
	}

	writeJsonString(bufferInput: Buffer | string) {
		const buffer =
			typeof bufferInput === "string" ? Buffer.from(bufferInput) : bufferInput;

		for (let i = 0; i < buffer.length; i++) {
			const num = buffer[i];

			if (this.tState === TokenStates.START) {
				this.offset++;
				this.parseStartState(num);
				continue;
			}

			// parsing multi byte character
			if (this.tState === TokenStates.STRING1) {
				if (this.bytes_remaining === 0 && num >= 128) {
					if (num <= 193 || num > 244) {
						this.tState = TokenStates.STOP;
						throw new Error(`Invalid UTF-8 character at position ${i}`);
					}

					// assigning expected number bytes for multi byte char
					if (num >= 194 && num <= 223) this.bytes_in_sequence = 2;
					if (num >= 224 && num <= 239) this.bytes_in_sequence = 3;
					if (num >= 240 && num <= 244) this.bytes_in_sequence = 4;

					// if multi byte char is not completed then we need to store current byte in temp buff
					if (this.bytes_in_sequence + i < buffer.length) {
						for (let k = 0; k <= buffer.length - 1 - i; k++) {
							this.temp_buffs[this.bytes_in_sequence][k] = buffer[i + k]; // fill temp buffer of correct size with bytes available in this chunk
						}
						this.bytes_remaining = i + this.bytes_in_sequence - buffer.length;
						i = buffer.length - 1;
					} else {
						this.appendStringBuffer(buffer, i, i + this.bytes_in_sequence);
						i = i + this.bytes_in_sequence - 1;
					}
				} else if (this.bytes_remaining > 0) {
					let j = 0;
					for (j = 0; j < this.bytes_remaining; j++) {
						this.temp_buffs[this.bytes_in_sequence][
							this.bytes_in_sequence - this.bytes_remaining + j
						] = buffer[j];
					}

					this.appendStringBuffer(this.temp_buffs[this.bytes_in_sequence]);
					this.bytes_in_sequence = this.bytes_remaining = 0;
					i = i + j - 1;
				} else if ('"'.charCodeAt(0) === num) {
					// if Double quote then end of string
					this.tState = TokenStates.START;
					this.string += this.stringBuffer.toString(
						"utf8",
						0,
						this.stringBufferOffset
					);
					this.stringBufferOffset = 0;
					this.processToken(ParserToken.STRING, this.string);
					this.offset += Buffer.byteLength(this.string as string, "utf8") + 1;
					this.string = undefined;
				} else if ("\\".charCodeAt(0) === num) {
					this.tState = TokenStates.STRING2;
				} else if (" ".charCodeAt(0) <= num) {
					this.appendCharToString(num);
				} else {
					this.unknownCharacterError(num, i);
				}

				continue;
			}

			if (this.tState === TokenStates.STRING2) {
				this.processBackSlashString(num, i);
				continue;
			}

			if (
				[
					TokenStates.STRING3,
					TokenStates.STRING4,
					TokenStates.STRING5,
					TokenStates.STRING6,
				].includes(this.tState)
			) {
				this.processUnicodeString(num, i);
				continue;
			}

			if ([TokenStates.NUMBER1, TokenStates.NUMBER2].includes(this.tState)) {
				const specialChar = [".", "e", "E", "+", "-"].map((sChar) =>
					sChar.charCodeAt(0)
				);
				if (
					(num >= "0".charCodeAt(0) && num <= "9".charCodeAt(0)) ||
					specialChar.includes(num)
				) {
					this.string += String.fromCharCode(num);
					this.tState = TokenStates.NUMBER2;
					continue;
				}

				// completion of number so processing that
				this.tState = TokenStates.START;
				this.processNumber(this.string as string);
				this.offset += (this.string as string).length - 1;
				this.string = undefined;
				i--; // remove current element iterator to process again
				continue;
			}

			/**
			 * True1 .. True3 for this sequentially checking if true value is available or not
			 * if true properly found then changing state to start and processing token
			 */
			if (this.tState === TokenStates.TRUE1 && num === "r".charCodeAt(0)) {
				this.tState = TokenStates.TRUE2;
				continue;
			}
			if (this.tState === TokenStates.TRUE2 && num === "u".charCodeAt(0)) {
				this.tState = TokenStates.TRUE3;
				continue;
			}
			if (this.tState === TokenStates.TRUE3 && num === "e".charCodeAt(0)) {
				this.tState = TokenStates.START;
				this.processToken(ParserToken.TRUE, true);
				this.offset += 3;
				continue;
			}

			/**
			 * almost similar to true checking for false as well
			 */
			if (this.tState === TokenStates.FALSE1 && num === "a".charCodeAt(0)) {
				this.tState = TokenStates.FALSE2;
				continue;
			}
			if (this.tState === TokenStates.FALSE2 && num === "l".charCodeAt(0)) {
				this.tState = TokenStates.FALSE3;
				continue;
			}
			if (this.tState === TokenStates.FALSE3 && num === "s".charCodeAt(0)) {
				this.tState = TokenStates.FALSE4;
				continue;
			}
			if (this.tState === TokenStates.FALSE4 && num === "e".charCodeAt(0)) {
				this.tState = TokenStates.START;
				this.processToken(ParserToken.FALSE, false);
				this.offset += 4;
				continue;
			}

			/**
			 * Similar to true and false checking for null
			 */
			if (this.tState === TokenStates.NULL1 && num === "u".charCodeAt(0)) {
				this.tState = TokenStates.NULL2;
				continue;
			}
			if (this.tState === TokenStates.NULL2 && num === "l".charCodeAt(0)) {
				this.tState = TokenStates.NULL3;
				continue;
			}
			if (this.tState === TokenStates.NULL3 && num === "l".charCodeAt(0)) {
				this.tState = TokenStates.START;
				this.processToken(ParserToken.NULL, null);
				this.offset += 3;
				continue;
			}

			this.unknownCharacterError(num, i);
		}
	}

	private processBackSlashString(num: number, index: number) {
		if (num === '"'.charCodeAt(0)) {
			this.appendCharToString(num);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.BACK_SLASH) {
			this.appendCharToString(ParserSpecialChars.BACK_SLASH);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.FORWARD_SLASH) {
			this.appendCharToString(ParserSpecialChars.FORWARD_SLASH);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.BACKSPACE) {
			this.appendCharToString(ParserSpecialChars.BACKSPACE);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.FORM_FEED) {
			this.appendCharToString(ParserSpecialChars.FORM_FEED);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.NEW_LINE) {
			this.appendCharToString(ParserSpecialChars.NEW_LINE);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.CARRIAGE_RETURN) {
			this.appendCharToString(ParserSpecialChars.CARRIAGE_RETURN);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.TAB) {
			this.appendCharToString(ParserSpecialChars.TAB);
			this.tState = TokenStates.STRING1;
			return;
		}

		if (num === ParserSpecialChars.UNI_CODE) {
			this.unicode = "";
			this.tState = TokenStates.STRING3;
			return;
		}

		return this.unknownCharacterError(num, index);
	}

	private processUnicodeString(num: number, index: number) {
		const isValidNum =
			(num >= ParserSpecialChars.ZERO && num <= ParserSpecialChars.NINE) ||
			(num >= ParserSpecialChars.A && num <= ParserSpecialChars.Z) ||
			(num >= ParserSpecialChars.a && num <= ParserSpecialChars.z);

		if (!isValidNum) {
			return this.unknownCharacterError(num, index);
		}

		this.unicode = (this.unicode as string) + String.fromCharCode(num);
		this.tState++;

		// 4 byte read
		if (this.tState === TokenStates.STRING6) {
			const intVal = parseInt(this.unicode, 16);
			this.unicode = undefined;

			// if 2 byte units (4 byte) then dividing in to high and low surrogate
			if (this.highSurrogate && intVal >= 0xdc00 && intVal <= 0xdfff) {
				// handling low surrogate
				this.appendStringBuffer(
					Buffer.from(String.fromCharCode(this.highSurrogate, intVal))
				);
				this.highSurrogate = undefined;
			} else if (!this.highSurrogate && intVal >= 0xd800 && intVal <= 0xdbff) {
				// handling high surrogate
				this.highSurrogate = intVal;
			} else {
				// handling 1 byte unit (2 byte)
				if (this.highSurrogate !== undefined) {
					// If a high surrogate is still stored then flushing it
					this.appendStringBuffer(
						Buffer.from(String.fromCharCode(this.highSurrogate))
					);
					this.highSurrogate = undefined;
				}
				this.appendStringBuffer(Buffer.from(String.fromCharCode(intVal)));
			}

			this.tState = TokenStates.STRING1;
		}
	}

	private appendCharToString(char: number) {
		if (this.stringBufferOffset >= STRING_BUFFER_SIZE) {
			this.string += this.stringBuffer.toString("utf8");
			this.stringBufferOffset = 0;
		}

		this.stringBuffer[this.stringBufferOffset++] = char;
	}

	private appendStringBuffer(buffer: Buffer, start?: number, end?: number) {
		let size = buffer.length;

		if (start && end && end < 0) {
			// adding a negative end decrease the size
			size = buffer.length - start + end;
		} else if (start && end) {
			size = end - start;
		} else if (start) {
			size = buffer.length - start;
		}

		if (size < 0) {
			size = 0;
		}

		if (this.stringBufferOffset + size > STRING_BUFFER_SIZE) {
			this.string += this.stringBuffer.toString(
				"utf8",
				0,
				this.stringBufferOffset
			);
			this.stringBufferOffset = 0;
		}

		buffer.copy(this.stringBuffer, this.stringBufferOffset, start, end);
		this.stringBufferOffset += size;
	}

	private parseStartState(num: number) {
		if (num >= ParserToken.ZERO && num <= ParserToken.NINE) {
			this.string = String.fromCharCode(num);
			this.tState = TokenStates.NUMBER2;
			return;
		}

		switch (num) {
			case ParserToken.LEFT_BRACE: {
				this.processToken(ParserToken.LEFT_BRACE, "{");
				break;
			}

			case ParserToken.RIGHT_BRACE: {
				this.processToken(ParserToken.RIGHT_BRACE, "}");
				break;
			}

			case ParserToken.LEFT_BRACKET: {
				this.processToken(ParserToken.LEFT_BRACKET, "[");
				break;
			}

			case ParserToken.RIGHT_BRACKET: {
				this.processToken(ParserToken.RIGHT_BRACKET, "]");
				break;
			}

			case ParserToken.COLON: {
				this.processToken(ParserToken.COLON, ":");
				break;
			}

			case ParserToken.COMMA: {
				this.processToken(ParserToken.COMMA, ",");
				break;
			}

			case ParserToken.TRUE: {
				this.tState = TokenStates.TRUE1;
				break;
			}

			case ParserToken.FALSE: {
				this.tState = TokenStates.FALSE1;
				break;
			}

			case ParserToken.NULL: {
				this.tState = TokenStates.NULL1;
				break;
			}

			case ParserToken.STRING: {
				this.string = "";
				this.stringBufferOffset = 0;
				this.tState = TokenStates.STRING1; // Normal string initilization
				break;
			}

			case ParserToken.NEGATIVE_NUMBER: {
				this.string = "-";
				this.tState = TokenStates.NUMBER1;
				break;
			}

			case ParserToken.EMPTY_SPACE:
			case ParserToken.NEW_LINE:
			case ParserToken.CARRIAGE_RETURN:
			case ParserToken.TAB: {
				break;
			}

			default: {
				return this.unknownCharacterError(num, this.offset);
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private processToken(token: ParserToken, value: any) {
		if (this.state === ParserStates.VALUE) {
			return this.processValueStateToken(token, value);
		}

		if (this.state === ParserStates.KEY) {
			return this.processKeyStateToken(token, value);
		}

		if (this.state === ParserStates.COLON) {
			return this.processColonStateToken(token, value);
		}

		if (this.state === ParserStates.COMMA) {
			return this.processCommaStateToken(token, value);
		}

		return this.jsonParsingError(token, value);
	}

	private processValueStateToken(token: ParserToken, value: unknown) {
		/**
		 * If Token is string, true, false , null then assigning to value and then emitting the value to constructor function
		 */
		if (
			token === ParserToken.NEGATIVE_NUMBER ||
			token === ParserToken.ZERO ||
			token === ParserToken.NINE ||
			token === ParserToken.STRING ||
			token === ParserToken.TRUE ||
			token === ParserToken.FALSE ||
			token === ParserToken.NULL
		) {
			if (this.value) {
				this.value[this.key as string] = value;
			}
			this.emitValue(value);
			return;
		}

		/**
		 * If token is "{" then adding empty object and Changing state to expect key and mode to be as object
		 */

		if (token === ParserToken.LEFT_BRACE) {
			this.pushToStack();
			if (this.value) {
				this.value = this.value[this.key as string] = {};
			} else {
				this.value = {};
			}
			this.key = undefined;
			this.state = ParserStates.KEY;
			this.mode = ParserMode.OBJECT;
			return;
		}

		/**
		 * If Token is "[" then adding empty array to value and changing state value and mode to array
		 */
		if (token === ParserToken.LEFT_BRACKET) {
			this.pushToStack();
			if (this.value) {
				this.value = this.value[this.key as string] = [];
			} else {
				this.value = [];
			}
			this.key = 0;
			this.state = ParserStates.VALUE;
			this.mode = ParserMode.ARRAY;
			return;
		}

		/**
		 * If Token is "}" and mode is object
		 * if Token is "]" and mode if array
		 * then pop from stack so that we can store multiple array and big list of object in our stack
		 */
		if (
			(token === ParserToken.RIGHT_BRACE && this.mode === ParserMode.OBJECT) ||
			(token === ParserToken.RIGHT_BRACKET && this.mode === ParserMode.ARRAY)
		) {
			this.popFromStack();
			return;
		}

		this.jsonParsingError(token, value);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private processKeyStateToken(token: ParserToken, value: any) {
		// if token is string then next expecting colon
		if (token === ParserToken.STRING) {
			this.key = value;
			this.state = ParserStates.COLON;
			return;
		}

		// if {} empty object then pop from stack
		if (token === ParserToken.RIGHT_BRACE) {
			this.popFromStack();
			return;
		}

		return this.jsonParsingError(token, value);
	}

	private processColonStateToken(token: ParserToken, value: unknown) {
		// expecting value state after getting colon
		if (token === ParserToken.COLON) {
			this.state = ParserStates.VALUE;
			return;
		}
		return this.jsonParsingError(token, value);
	}

	private processCommaStateToken(token: ParserToken, value: unknown) {
		if (token === ParserToken.COMMA) {
			/** if Token = COMMA then Either mode can be array or object 
				if array then increasing the key to fetch next items
				if object then processing another key after comma
			**/
			if (this.mode === ParserMode.ARRAY) {
				this.key = (this.key as number) + 1;
				this.state = ParserStates.VALUE;
				return;
			} else if (this.mode === ParserMode.OBJECT) {
				this.state = ParserStates.KEY;
				return;
			}
		} else if (
			/**
			 * Processing Of COMMA is Completed so removing from stack
			 */
			(token === ParserToken.RIGHT_BRACE && this.mode === ParserMode.OBJECT) ||
			(token === ParserToken.RIGHT_BRACKET && this.mode === ParserMode.ARRAY)
		) {
			this.popFromStack();
			return;
		}
		return this.jsonParsingError(token, value);
	}

	private processNumber(s: string) {
		const stringToNum = Number(s);

		if (isNaN(stringToNum)) {
			this.tState = TokenStates.STOP;
			throw new Error(`Unexpected number ${s}`);
		}

		if (stringToNum.toString() !== s) {
			this.processToken(ParserToken.STRING, s);
		} else {
			this.processToken(ParserToken.ZERO, stringToNum); // to indicate this is number
		}
	}

	private pushToStack() {
		this.stack.push({ value: this.value, key: this.key, mode: this.mode });
	}

	/**
	 * Pop From stack and assign key value and mode to parent
	 */
	private popFromStack() {
		const value = this.value;
		const parent = this.stack.pop();

		if (parent === undefined) {
			this.tState = TokenStates.STOP;
			throw new Error("Stack is empty");
		}

		this.value = parent.value;
		this.key = parent.key;
		this.mode = parent.mode;
		this.emitValue(value);

		if (!this.mode) {
			this.state = ParserStates.VALUE;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private emitValue(value: any) {
		if (this.mode) {
			this.state = ParserStates.COMMA;
		}
		this.onValue(value);
	}

	private unknownCharacterError(num: number, i: number) {
		this.tState = TokenStates.STOP;
		throw new Error(`Unexpected ${String.fromCharCode(num)} at position ${i}`);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private jsonParsingError(token: ParserToken, value: any) {
		this.tState = TokenStates.STOP;
		throw new Error(
			`Unexpected ${token} ${value ? "(" + JSON.stringify(value) + ")" : ""}`
		);
	}
}
