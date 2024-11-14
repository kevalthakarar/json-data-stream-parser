import { TokenStates, ParserToken, ParserStates, ParserMode, ParserSpecialChars, STRING_BUFFER_SIZE} from './constants';

export class JSONParseProcessing {
    
    private tState: TokenStates;
    private key: undefined;
    private value: undefined;
    private string: string | undefined;
    private stringBuffer: Buffer;
    private stringBufferOffset: number;
    private unicode: undefined;
    private highSurrogate: undefined;
    private mode: ParserMode;
    private stack: unknown[];
    private state: ParserStates;

    private bytes_remaining: number; // number of bytes remaining in multi byte utf8 char to read after split boundary 
    
    private bytes_in_sequence: number; // bytes in multi byte utf8 char to read
    
    private temp_buffs: {[key: string]: Buffer}; // for rebuilding chars split before boundary is reached
    
    private offset: number; // stream offset

    constructor() {
        this.tState = TokenStates.START;
        this.key = undefined;
        this.value = undefined;
        this.stringBuffer = Buffer.alloc(STRING_BUFFER_SIZE);
        this.stringBufferOffset = 0;
        this.unicode = undefined;
        this.highSurrogate = undefined;
        this.mode = ParserMode.OBJECT;
        this.stack = [];
        this.state = ParserStates.VALUE;
        this.bytes_remaining = 0; 
        this.bytes_in_sequence = 0; 
        this.temp_buffs = { 
            "2": Buffer.alloc(2), 
            "3": Buffer.alloc(3), 
            "4": Buffer.alloc(4) 
        };
        this.offset = -1;
    }

    writeJsonString(bufferInput: Buffer | string){

        const buffer = typeof bufferInput === "string" ? Buffer.from(bufferInput) : bufferInput;

        for(let i = 0; i < buffer.length; i++){
            if(this.tState == TokenStates.START){
                this.offset++;
                this.parseStartState(buffer[i]);
            }
        }
    }

    private parseStartState(num: number) {
        switch(num){
            case ParserToken.LEFT_BRACE: {
                break;
            }

            case ParserToken.RIGHT_BRACE: {
                break;
            }

            case ParserToken.LEFT_BRACKET: {
                break;
            }

            case ParserToken.RIGHT_BRACKET: {
                break;
            }

            case ParserToken.COLON: {
                break;
            }

            case ParserToken.COMMA: {
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
                this.tState = TokenStates.STRING1;  // Normal string initilization
                break;
            }

            default: {
                return this.unknownCharacterError(num , this.offset);
            }
        }
    }







    private unknownCharacterError(num: number, i: number) {
        this.tState = TokenStates.STOP;
        throw new Error(`Unexpected ${String.fromCharCode(num)} at position ${i}`);
    }
}