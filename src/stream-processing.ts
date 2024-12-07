import { Transform } from "stream";
import { PathListTypes } from './types';
import { JSONParseProcessing } from "./json-parse-processing";

export class StreamProcessing {
  private jsonParser: JSONParseProcessing;
  private transformStream: Transform | undefined;
  private pathList: PathListTypes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buffer: any[];

  constructor() {
    this.jsonParser = new JSONParseProcessing(this.onValue.bind(this));
    this.pathList = this.parseInputPath(null);
    this.buffer = [];
  }

  parseStream(path?: string | null) {
    this.pathList = this.parseInputPath(path);
    //this.transformStream = new Stream();
    this.transformStream = new Transform({
      write: (
        chunk: Buffer,
        encoding: BufferEncoding,
        callback: (error?: Error | null) => void
      ) => {
        this.jsonParser.writeJsonString(chunk);
        callback();
      },
    });
    return this.transformStream;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onValue(value: any) {
    if (!this.pathList) {
      return;
    }

    let i = 0; // iterates on path
    let j = 0; // iterates on stack
    let emitKey = false;


    while (i < this.pathList.length) {
      const key = this.pathList[i];
      j++;

      if (key && (typeof key === 'string' || typeof key === 'boolean' || !key?.recurse)) {
        const c = (j === this.jsonParser.stack.length) ? this.jsonParser : this.jsonParser.stack[j];
        if (!c) {
          return;
        }

        if (!this.check(key, c.key)) {
          return
        }
        emitKey = typeof key == 'object' ? !!key?.emitKey : emitKey;
        i++;
      }
      else {
        i++;
        const nextKey = this.pathList[i];
        if (!nextKey) {
          return;
        }

        while (true) {
          const c = (j === this.jsonParser.stack.length) ? this.jsonParser : this.jsonParser.stack[j];
          if (!c) return;

          if (this.check(nextKey, c.key)) {
            i++;

            if (!Object.isFrozen(this.jsonParser.stack[j])) {
              this.jsonParser.stack[j].value = null;
            }

            break;
          }

          j++;

        }
      }


    }

    if (j !== this.jsonParser.stack.length) {
      return;
    }

    const data = value;

    if (data) {
      this.buffer.push(data);
      this.drain();
    }

    for (const k in this.jsonParser.stack) {
      if (!Object.isFrozen(this.jsonParser.stack[k]))
        this.jsonParser.stack[k].value = null;
    }
  }

  private parseInputPath(path?: string | null): PathListTypes {
    if (typeof path !== "string") {
      return null;
    }

    const pathList = path.split(".").map((p) => {
      if (p === "$*") {
        return { emitKey: true };
      }

      if (p === "*") {
        return true;
      }

      if (p === "") {
        // double dot generated as empty string when split using "."
        return { recurse: true };
      }

      return p;
    });

    if (pathList.length === 0) {
      return null;
    }

    return pathList;
  }

  private check(x: string | boolean | object | undefined | number, y: string | boolean | object | undefined | number) {

    if (typeof x === 'string') {
      return x === y;
    }

    if (typeof x === 'boolean' || typeof x === 'object') {
      return x;
    }

    return false;
  }

  private drain() {
    while (this.transformStream && this.buffer.length) {
      const data = this.buffer.shift();
      this.transformStream.push(JSON.stringify(data));
    }
  }
}