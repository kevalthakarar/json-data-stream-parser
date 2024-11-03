import { TokenStates, ParserToken, ParserStates, ParserMode, ParserSpecialChars, STRING_BUFFER_SIZE} from './constants';

export class JSONParseProcessing {
    
    private tState: TokenStates;
    private key: undefined;
    private value: undefined;
    private string: undefined;
    private stringBuffer: Buffer;
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
        this.string = undefined;
        this.stringBuffer = Buffer.alloc(STRING_BUFFER_SIZE);
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
                this.parseStartState(buffer[i]);
            }
        }
    }

    private parseStartState(num: number) {
        
    }
}