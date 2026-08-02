/*!
 * unrar-lite.bundle.js
 * Pure-JS RAR/CBR unpacker adapted from the "unrar.js" npm package
 * (originally salvaged from Google's bitjs/kthoom by antimatter15,
 * packaged by Thomas Lanteigne). MIT licensed — see LICENSE in this folder.
 * Repackaged here as a plain browser global (no bundler, no Node deps)
 * for 100% offline use inside LibroLibre / Apache Cordova.
 * Supports RAR 2.0/2.9 compression (the vast majority of .cbr/.rar files
 * in the wild). RAR5 archives are not supported by this pure-JS decoder.
 */
(function (global) {
  'use strict';
  var __modules = {};
  var __cache = {};

  // Minimal EventEmitter + util.inherits shim (RarEventMgr expects Node's core modules).
  function EventEmitter() { this._listeners = {}; }
  EventEmitter.prototype.on = function (ev, fn) {
    (this._listeners[ev] = this._listeners[ev] || []).push(fn);
    return this;
  };
  EventEmitter.prototype.emit = function (ev) {
    var args = Array.prototype.slice.call(arguments, 1);
    (this._listeners[ev] || []).forEach(function (fn) { fn.apply(null, args); });
    return true;
  };
  var util = {
    inherits: function (ctor, superCtor) {
      ctor.prototype = Object.create(superCtor.prototype);
      ctor.prototype.constructor = ctor;
    }
  };

  function __require(name) {
    if (name === 'events') return EventEmitter;
    if (name === 'util') return util;
    var base = name.replace(/^\.\//, '');
    if (__cache[base]) return __cache[base].exports;
    var mod = { exports: {} };
    __cache[base] = mod;
    __modules[base](mod, mod.exports, __require);
    return mod.exports;
  }

  __modules['BitStream'] = function (module, exports, require) {
// mask for getting N number of bits (0-8)
var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF];


/**
 * This bit stream peeks and consumes bits out of a binary stream.
 *
 * @param {ArrayBuffer} ab An ArrayBuffer object or a Uint8Array.
 * @param {boolean} rtl Whether the stream reads bits from the byte starting
 *     from bit 7 to 0 (true) or bit 0 to 7 (false).
 * @param {Number} opt_offset The offset into the ArrayBuffer
 * @param {Number} opt_length The length of this BitStream
 */
function BitStream(ab, rtl, opt_offset, opt_length) {
    // if (!ab || !ab.toString || ab.toString() !== "[object ArrayBuffer]") {
    //     throw "Error! BitArray constructed with an invalid ArrayBuffer object";
    // }

    var offset = opt_offset || 0;
    var length = opt_length || ab.byteLength;
    this.bytes = new Uint8Array(ab, offset, length);
    this.bytePtr = 0; // tracks which byte we are on
    this.bitPtr = 0; // tracks which bit we are on (can have values 0 through 7)
    this.peekBits = rtl ? this.peekBits_rtl : this.peekBits_ltr;
};


/**
 *   byte0      byte1      byte2      byte3
 * 7......0 | 7......0 | 7......0 | 7......0
 *
 * The bit pointer starts at bit0 of byte0 and moves left until it reaches
 * bit7 of byte0, then jumps to bit0 of byte1, etc.
 * @param {number} n The number of bits to peek.
 * @param {boolean=} movePointers Whether to move the pointer, defaults false.
 * @return {number} The peeked bits, as an unsigned number.
 */
BitStream.prototype.peekBits_ltr = function(n, movePointers) {
    if (n <= 0 || typeof n != typeof 1) {
        return 0;
    }

    var movePointers = movePointers || false,
        bytePtr = this.bytePtr,
        bitPtr = this.bitPtr,
        result = 0,
        bitsIn = 0,
        bytes = this.bytes;

    // keep going until we have no more bits left to peek at
    // TODO: Consider putting all bits from bytes we will need into a variable and then
    //       shifting/masking it to just extract the bits we want.
    //       This could be considerably faster when reading more than 3 or 4 bits at a time.
    while (n > 0) {
        if (bytePtr >= bytes.length) {
            throw "Error!  Overflowed the bit stream! n=" + n + ", bytePtr=" + bytePtr + ", bytes.length=" +
                bytes.length + ", bitPtr=" + bitPtr;
            return -1;
        }

        var numBitsLeftInThisByte = (8 - bitPtr);
        if (n >= numBitsLeftInThisByte) {
            var mask = (BITMASK[numBitsLeftInThisByte] << bitPtr);
            result |= (((bytes[bytePtr] & mask) >> bitPtr) << bitsIn);

            bytePtr++;
            bitPtr = 0;
            bitsIn += numBitsLeftInThisByte;
            n -= numBitsLeftInThisByte;
        } else {
            var mask = (BITMASK[n] << bitPtr);
            result |= (((bytes[bytePtr] & mask) >> bitPtr) << bitsIn);

            bitPtr += n;
            bitsIn += n;
            n = 0;
        }
    }

    if (movePointers) {
        this.bitPtr = bitPtr;
        this.bytePtr = bytePtr;
    }

    return result;
};


/**
 *   byte0      byte1      byte2      byte3
 * 7......0 | 7......0 | 7......0 | 7......0
 *
 * The bit pointer starts at bit7 of byte0 and moves right until it reaches
 * bit0 of byte0, then goes to bit7 of byte1, etc.
 * @param {number} n The number of bits to peek.
 * @param {boolean=} movePointers Whether to move the pointer, defaults false.
 * @return {number} The peeked bits, as an unsigned number.
 */
BitStream.prototype.peekBits_rtl = function(n, movePointers) {
    if (n <= 0 || typeof n != typeof 1) {
        return 0;
    }

    var movePointers = movePointers || false,
        bytePtr = this.bytePtr,
        bitPtr = this.bitPtr,
        result = 0,
        bytes = this.bytes;

    // keep going until we have no more bits left to peek at
    // TODO: Consider putting all bits from bytes we will need into a variable and then
    //       shifting/masking it to just extract the bits we want.
    //       This could be considerably faster when reading more than 3 or 4 bits at a time.
    while (n > 0) {

        if (bytePtr >= bytes.length) {
            throw "Error!  Overflowed the bit stream! n=" + n + ", bytePtr=" + bytePtr + ", bytes.length=" +
                bytes.length + ", bitPtr=" + bitPtr;
            return -1;
        }

        var numBitsLeftInThisByte = (8 - bitPtr);
        if (n >= numBitsLeftInThisByte) {
            result <<= numBitsLeftInThisByte;
            result |= (BITMASK[numBitsLeftInThisByte] & bytes[bytePtr]);
            bytePtr++;
            bitPtr = 0;
            n -= numBitsLeftInThisByte;
        } else {
            result <<= n;
            result |= ((bytes[bytePtr] & (BITMASK[n] << (8 - n - bitPtr))) >> (8 - n - bitPtr));

            bitPtr += n;
            n = 0;
        }
    }

    if (movePointers) {
        this.bitPtr = bitPtr;
        this.bytePtr = bytePtr;
    }

    return result;
};


/**
 * Some voodoo magic.
 */
BitStream.prototype.getBits = function() {
    return (((((this.bytes[this.bytePtr] & 0xff) << 16) +
        ((this.bytes[this.bytePtr + 1] & 0xff) << 8) +
        ((this.bytes[this.bytePtr + 2] & 0xff))) >>> (8 - this.bitPtr)) & 0xffff);
};


/**
 * Reads n bits out of the stream, consuming them (moving the bit pointer).
 * @param {number} n The number of bits to read.
 * @return {number} The read bits, as an unsigned number.
 */
BitStream.prototype.readBits = function(n) {
    return this.peekBits(n, true);
};


/**
 * This returns n bytes as a sub-array, advancing the pointer if movePointers
 * is true.  Only use this for uncompressed blocks as this throws away remaining
 * bits in the current byte.
 * @param {number} n The number of bytes to peek.
 * @param {boolean=} movePointers Whether to move the pointer, defaults false.
 * @return {Uint8Array} The subarray.
 */
BitStream.prototype.peekBytes = function(n, movePointers) {
    if (n <= 0 || typeof n != typeof 1) {
        return 0;
    }

    // from http://tools.ietf.org/html/rfc1951#page-11
    // "Any bits of input up to the next byte boundary are ignored."
    while (this.bitPtr != 0) {
        this.readBits(1);
    }

    var movePointers = movePointers || false;
    var bytePtr = this.bytePtr,
        bitPtr = this.bitPtr;

    var result = this.bytes.subarray(bytePtr, bytePtr + n);

    if (movePointers) {
        this.bytePtr += n;
    }

    return result;
};


/**
 * @param {number} n The number of bytes to read.
 * @return {Uint8Array} The subarray.
 */
BitStream.prototype.readBytes = function(n) {
    return this.peekBytes(n, true);
};

module.exports = BitStream;

  };

  __modules['ByteBuffer'] = function (module, exports, require) {
/**
 * A write-only Byte buffer which uses a Uint8 Typed Array as a backing store.
 * @param {number} numBytes The number of bytes to allocate.
 * @constructor
 */
function ByteBuffer(numBytes) {
    if (typeof numBytes != typeof 1 || numBytes <= 0) {
        throw "Error! ByteBuffer initialized with '" + numBytes + "'";
    }
    this.data = new Uint8Array(numBytes);
    this.ptr = 0;
};


/**
 * @param {number} b The byte to insert.
 */
ByteBuffer.prototype.insertByte = function(b) {
    // TODO: throw if byte is invalid?
    this.data[this.ptr++] = b;
};


/**
 * @param {Array.<number>|Uint8Array|Int8Array} bytes The bytes to insert.
 */
ByteBuffer.prototype.insertBytes = function(bytes) {
    // TODO: throw if bytes is invalid?
    this.data.set(bytes, this.ptr);
    this.ptr += bytes.length;
};


/**
 * Writes an unsigned number into the next n bytes.  If the number is too large
 * to fit into n bytes or is negative, an error is thrown.
 * @param {number} num The unsigned number to write.
 * @param {number} numBytes The number of bytes to write the number into.
 */
ByteBuffer.prototype.writeNumber = function(num, numBytes) {
    if (numBytes < 1) {
        throw 'Trying to write into too few bytes: ' + numBytes;
    }
    if (num < 0) {
        throw 'Trying to write a negative number (' + num +
            ') as an unsigned number to an ArrayBuffer';
    }
    if (num > (Math.pow(2, numBytes * 8) - 1)) {
        throw 'Trying to write ' + num + ' into only ' + numBytes + ' bytes';
    }

    // Roll 8-bits at a time into an array of bytes.
    var bytes = [];
    while (numBytes-- > 0) {
        var eightBits = num & 255;
        bytes.push(eightBits);
        num >>= 8;
    }

    this.insertBytes(bytes);
};


/**
 * Writes a signed number into the next n bytes.  If the number is too large
 * to fit into n bytes, an error is thrown.
 * @param {number} num The signed number to write.
 * @param {number} numBytes The number of bytes to write the number into.
 */
ByteBuffer.prototype.writeSignedNumber = function(num, numBytes) {
    if (numBytes < 1) {
        throw 'Trying to write into too few bytes: ' + numBytes;
    }

    var HALF = Math.pow(2, (numBytes * 8) - 1);
    if (num >= HALF || num < -HALF) {
        throw 'Trying to write ' + num + ' into only ' + numBytes + ' bytes';
    }

    // Roll 8-bits at a time into an array of bytes.
    var bytes = [];
    while (numBytes-- > 0) {
        var eightBits = num & 255;
        bytes.push(eightBits);
        num >>= 8;
    }

    this.insertBytes(bytes);
};


/**
 * @param {string} str The ASCII string to write.
 */
ByteBuffer.prototype.writeASCIIString = function(str) {
    for (var i = 0; i < str.length; ++i) {
        var curByte = str.charCodeAt(i);
        if (curByte < 0 || curByte > 255) {
            throw 'Trying to write a non-ASCII string!';
        }
        this.insertByte(curByte);
    }
};

module.exports = ByteBuffer;

  };

  __modules['RarUtils'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */
var RarEventMgr = require("./RarEventMgr");

function RarUtils() {

    // shows a byte value as its hex representation
    var nibble = "0123456789ABCDEF";

    /*
     * Public Members
     */
    var rNC = 299,
        rDC = 60,
        rLDC = 17,
        rRC = 28,
        rBC = 20,
        rHUFF_TABLE_SIZE = (rNC + rDC + rRC + rLDC);

    // Volume Types
    this.VOLUME_TYPES = {
        MARK_HEAD: 0x72,
        MAIN_HEAD: 0x73,
        FILE_HEAD: 0x74,
        COMM_HEAD: 0x75,
        AV_HEAD: 0x76,
        SUB_HEAD: 0x77,
        PROTECT_HEAD: 0x78,
        SIGN_HEAD: 0x79,
        NEWSUB_HEAD: 0x7a,
        ENDARC_HEAD: 0x7b
    };

    this.BUFFERS = {
        unpack: null, // rBuffer for unpack / and update progress
        oldBuffers: [] // rOldBuffers
    };

    this.PROGRESS = {
        // Global Progress variables.
        currentFilename: "",
        currentFileNumber: 0,
        currentBytesUnarchivedInFile: 0,
        currentBytesUnarchived: 0,
        totalUncompressedBytesInArchive: 0,
        totalFilesInArchive: 0
    };


    this.CONST = {
        rLDecode: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224],
        rLBits: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5],
        rDBitLengthCounts: [4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 14, 0, 12],
        rSDDecode: [0, 4, 8, 16, 32, 64, 128, 192],
        rSDBits: [2, 2, 3, 4, 5, 6, 6, 6],

        rDDecode: [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32,
            48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072,
            4096, 6144, 8192, 12288, 16384, 24576, 32768, 49152, 65536, 98304,
            131072, 196608, 262144, 327680, 393216, 458752, 524288, 589824,
            655360, 720896, 786432, 851968, 917504, 983040
        ],
        rDBits: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
            5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14,
            15, 15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16
        ],

        // copied from private variables
        rNC: rNC,
        rDC: rDC,
        rLDC: rLDC,
        rRC: rRC,
        rBC: rBC,
        rHUFF_TABLE_SIZE: rHUFF_TABLE_SIZE,

        BD: { //bitdecode
            DecodeLen: new Array(16),
            DecodePos: new Array(16),
            DecodeNum: new Array(rBC)
        },
        LD: { //litdecode
            DecodeLen: new Array(16),
            DecodePos: new Array(16),
            DecodeNum: new Array(rNC)
        },
        DD: { //distdecode
            DecodeLen: new Array(16),
            DecodePos: new Array(16),
            DecodeNum: new Array(rDC)
        },
        LDD: { //low dist decode
            DecodeLen: new Array(16),
            DecodePos: new Array(16),
            DecodeNum: new Array(rLDC)
        },
        RD: { //rep decode
            DecodeLen: new Array(16),
            DecodePos: new Array(16),
            DecodeNum: new Array(rRC)
        }
    };

    /*
     * Public Methods
     */

    //==========================================================================
    this.reset = function() {
        this.BUFFERS.unpack = null;
        this.BUFFERS.oldBuffers.length = 0;
        this.PROGRESS.currentFilename = "";
        this.PROGRESS.currentFileNumber = 0;
        this.PROGRESS.currentBytesUnarchivedInFile = 0;
        this.PROGRESS.currentBytesUnarchived = 0;
        this.PROGRESS.totalUncompressedBytesInArchive = 0;
        this.PROGRESS.totalFilesInArchive = 0;
    };

    //==========================================================================
    this.byteValueToHexString = function(num) {
        return nibble[num >> 4] + nibble[num & 0xF];
    };

    //==========================================================================
    this.twoByteValueToHexString = function(num) {
        return nibble[(num >> 12) & 0xF] + nibble[(num >> 8) & 0xF] + nibble[(num >> 4) & 0xF] + nibble[num & 0xF];
    };

    //==========================================================================
    this.RarUpdateProgress = function() {
        var change = this.BUFFERS.unpack.ptr - this.PROGRESS.currentBytesUnarchivedInFile;
        this.PROGRESS.currentBytesUnarchivedInFile = this.BUFFERS.unpack.ptr;
        this.PROGRESS.currentBytesUnarchived += change;
        RarEventMgr.emitProgress(this.PROGRESS);
    };

    // used in RarUnpack29 and RarUnpack20
    //==========================================================================
    this.RarDecodeNumber = function(bstream, dec) {
        var DecodeLen = dec.DecodeLen,
            DecodePos = dec.DecodePos,
            DecodeNum = dec.DecodeNum,
            bitField = bstream.getBits() & 0xfffe;

        //some sort of rolled out binary search
        var bits = ((bitField < DecodeLen[8]) ?
            ((bitField < DecodeLen[4]) ?
                ((bitField < DecodeLen[2]) ?
                    ((bitField < DecodeLen[1]) ? 1 : 2) : ((bitField < DecodeLen[3]) ? 3 : 4)) : (bitField < DecodeLen[6]) ?
                ((bitField < DecodeLen[5]) ? 5 : 6) : ((bitField < DecodeLen[7]) ? 7 : 8)) : ((bitField < DecodeLen[12]) ?
                ((bitField < DecodeLen[10]) ?
                    ((bitField < DecodeLen[9]) ? 9 : 10) : ((bitField < DecodeLen[11]) ? 11 : 12)) : (bitField < DecodeLen[14]) ?
                ((bitField < DecodeLen[13]) ? 13 : 14) : 15));
        bstream.readBits(bits);
        var N = DecodePos[bits] + ((bitField - DecodeLen[bits - 1]) >>> (16 - bits));

        return DecodeNum[N];
    };

    //==========================================================================
    // used in RarUnpack29 and RarUnpack20
    this.RarMakeDecodeTables = function(BitLength, offset, dec, size) {
        var DecodeLen = dec.DecodeLen,
            DecodePos = dec.DecodePos,
            DecodeNum = dec.DecodeNum,
            LenCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            TmpPos = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            N = 0,
            M = 0,
            i,
            I;

        for (i = DecodeNum.length; i--;) {
            DecodeNum[i] = 0;
        }

        for (i = 0; i < size; i++) {
            LenCount[BitLength[i + offset] & 0xF]++;
        }

        LenCount[0] = 0;
        TmpPos[0] = 0;
        DecodePos[0] = 0;
        DecodeLen[0] = 0;

        for (I = 1; I < 16; ++I) {
            N = 2 * (N + LenCount[I]);
            M = (N << (15 - I));
            if (M > 0xFFFF)
                M = 0xFFFF;
            DecodeLen[I] = M;
            DecodePos[I] = DecodePos[I - 1] + LenCount[I - 1];
            TmpPos[I] = DecodePos[I];
        }

        for (I = 0; I < size; ++I) {
            if (BitLength[I + offset] != 0) {
                DecodeNum[TmpPos[BitLength[offset + I] & 0xF]++] = I;
            }
        }
    };

    //==========================================================================
    //this is the real function, the other one is for debugging
    this.RarCopyString = function(length, distance) {
        var destPtr = this.BUFFERS.unpack.ptr - distance;
        if (destPtr < 0) {
            var l = this.BUFFERS.oldBuffers.length;
            while (destPtr < 0) {
                destPtr = this.BUFFERS.oldBuffers[--l].data.length + destPtr;
            }
            //TODO: lets hope that it never needs to read beyond file boundaries
            while (length--) this.BUFFERS.unpack.insertByte(this.BUFFERS.oldBuffers[l].data[destPtr++]);

        }
        if (length > distance) {
            while (length--) this.BUFFERS.unpack.insertByte(this.BUFFERS.unpack.data[destPtr++]);
        } else {
            this.BUFFERS.unpack.insertBytes(this.BUFFERS.unpack.data.subarray(destPtr, destPtr + length));
        }
    };
}

module.exports = new RarUtils();

  };

  __modules['RarEventMgr'] = function (module, exports, require) {
const EventEmitter = require('events');
const util = require('util');

function RarEventMgr() {
    EventEmitter.call(this); // constructor

    this.TYPES = {
        START: 'start',
        PROGRESS: 'progress',
        EXTRACT: 'extract',
        FINISH: 'finish',
        INFO: 'info',
        ERROR: 'error'
    };

    this.emitStart = function() {
        this.emit(this.TYPES.START);
    };

    this.emitProgress = function(data) {
        this.emit(this.TYPES.PROGRESS, data);
    };

    this.emitExtract = function(file) {
        this.emit(this.TYPES.EXTRACT, file);
    };

    this.emitFinish = function(fileList) {
        this.emit(this.TYPES.FINISH, fileList);
    };

    this.emitInfo = function(str) {
        this.emit(this.TYPES.INFO, str);
    };

    this.emitError = function(err) {
        this.emit(this.TYPES.ERROR, err);
    };

}
util.inherits(RarEventMgr, EventEmitter);

module.exports = new RarEventMgr();

  };

  __modules['RarVolumeHeader'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */

var RarUtils = require("./RarUtils"),
    RarEventMgr = require("./RarEventMgr");

// bstream is a bit stream
function RarVolumeHeader(bstream) {

    var headPos = bstream.bytePtr;
    // byte 1,2
    RarEventMgr.emitInfo("Rar Volume Header @" + bstream.bytePtr);

    this.crc = bstream.readBits(16);
    RarEventMgr.emitInfo("  crc=" + this.crc);

    // byte 3
    this.headType = bstream.readBits(8);
    RarEventMgr.emitInfo("  headType=" + this.headType);

    // Get flags
    // bytes 4,5
    this.flags = {};
    this.flags.value = bstream.peekBits(16);

    RarEventMgr.emitInfo("  flags=" + RarUtils.twoByteValueToHexString(this.flags.value));
    switch (this.headType) {
        case RarUtils.VOLUME_TYPES.MAIN_HEAD:
            this.flags.MHD_VOLUME = !!bstream.readBits(1);
            this.flags.MHD_COMMENT = !!bstream.readBits(1);
            this.flags.MHD_LOCK = !!bstream.readBits(1);
            this.flags.MHD_SOLID = !!bstream.readBits(1);
            this.flags.MHD_PACK_COMMENT = !!bstream.readBits(1);
            this.flags.MHD_NEWNUMBERING = this.flags.MHD_PACK_COMMENT;
            this.flags.MHD_AV = !!bstream.readBits(1);
            this.flags.MHD_PROTECT = !!bstream.readBits(1);
            this.flags.MHD_PASSWORD = !!bstream.readBits(1);
            this.flags.MHD_FIRSTVOLUME = !!bstream.readBits(1);
            this.flags.MHD_ENCRYPTVER = !!bstream.readBits(1);
            bstream.readBits(6); // unused
            break;
        case RarUtils.VOLUME_TYPES.FILE_HEAD:
            this.flags.LHD_SPLIT_BEFORE = !!bstream.readBits(1); // 0x0001
            this.flags.LHD_SPLIT_AFTER = !!bstream.readBits(1); // 0x0002
            this.flags.LHD_PASSWORD = !!bstream.readBits(1); // 0x0004
            this.flags.LHD_COMMENT = !!bstream.readBits(1); // 0x0008
            this.flags.LHD_SOLID = !!bstream.readBits(1); // 0x0010
            bstream.readBits(3); // unused
            this.flags.LHD_LARGE = !!bstream.readBits(1); // 0x0100
            this.flags.LHD_UNICODE = !!bstream.readBits(1); // 0x0200
            this.flags.LHD_SALT = !!bstream.readBits(1); // 0x0400
            this.flags.LHD_VERSION = !!bstream.readBits(1); // 0x0800
            this.flags.LHD_EXTTIME = !!bstream.readBits(1); // 0x1000
            this.flags.LHD_EXTFLAGS = !!bstream.readBits(1); // 0x2000
            bstream.readBits(2); // unused
            RarEventMgr.emitInfo("  LHD_SPLIT_BEFORE = " + this.flags.LHD_SPLIT_BEFORE);
            break;
        default:
            bstream.readBits(16);
    }

    // byte 6,7
    this.headSize = bstream.readBits(16);
    RarEventMgr.emitInfo("  headSize=" + this.headSize);
    switch (this.headType) {
        case RarUtils.VOLUME_TYPES.MAIN_HEAD:
            this.highPosAv = bstream.readBits(16);
            this.posAv = bstream.readBits(32);
            if (this.flags.MHD_ENCRYPTVER) {
                this.encryptVer = bstream.readBits(8);
            }
            RarEventMgr.emitInfo("Found MAIN_HEAD with highPosAv=" + this.highPosAv + ", posAv=" + this.posAv);
            break;
        case RarUtils.VOLUME_TYPES.FILE_HEAD:
            this.packSize = bstream.readBits(32);
            this.unpackedSize = bstream.readBits(32);
            this.hostOS = bstream.readBits(8);
            this.fileCRC = bstream.readBits(32);
            this.fileTime = bstream.readBits(32);
            this.unpVer = bstream.readBits(8);
            this.method = bstream.readBits(8);
            this.nameSize = bstream.readBits(16);
            this.fileAttr = bstream.readBits(32);

            if (this.flags.LHD_LARGE) {
                RarEventMgr.emitInfo("Warning: Reading in LHD_LARGE 64-bit size values");
                this.HighPackSize = bstream.readBits(32);
                this.HighUnpSize = bstream.readBits(32);
            } else {
                this.HighPackSize = 0;
                this.HighUnpSize = 0;
                if (this.unpackedSize == 0xffffffff) {
                    this.HighUnpSize = 0x7fffffff
                    this.unpackedSize = 0xffffffff;
                }
            }
            this.fullPackSize = 0;
            this.fullUnpackSize = 0;
            this.fullPackSize |= this.HighPackSize;
            this.fullPackSize <<= 32;
            this.fullPackSize |= this.packSize;

            // read in filename
            this.filename = bstream.readBytes(this.nameSize);
            var _i,
                fileNameStr = '';

            for (_i = 0; _i < this.filename.length; _i++) {
                fileNameStr += String.fromCharCode(this.filename[_i]);
            }

            fileNameStr = fileNameStr.replace(/\\/g, "/");

            this.filename = fileNameStr;

            if (this.flags.LHD_SALT) {
                RarEventMgr.emitInfo("Warning: Reading in 64-bit salt value");
                this.salt = bstream.readBits(64); // 8 bytes
            }

            if (this.flags.LHD_EXTTIME) {
                // 16-bit flags
                var extTimeFlags = bstream.readBits(16);

                // this is adapted straight out of arcread.cpp, Archive::ReadHeader()
                for (var I = 0; I < 4; ++I) {
                    var rmode = extTimeFlags >> ((3 - I) * 4);
                    if ((rmode & 8) == 0)
                        continue;
                    if (I != 0)
                        bstream.readBits(16);
                    var count = (rmode & 3);
                    for (var J = 0; J < count; ++J)
                        bstream.readBits(8);
                }
            }

            if (this.flags.LHD_COMMENT) {
                RarEventMgr.emitInfo("Found a LHD_COMMENT");
            }


            while (headPos + this.headSize > bstream.bytePtr) {
                bstream.readBits(1);
            }

            RarEventMgr.emitInfo("Found FILE_HEAD with packSize=" + this.packSize + ", unpackedSize= " + this.unpackedSize + ", hostOS=" + this.hostOS + ", unpVer=" + this.unpVer + ", method=" + this.method + ", filename=" + this.filename);

            break;
        default:
            RarEventMgr.emitInfo("Found a header of type 0x" + RarUtils.byteValueToHexString(this.headType));
            // skip the rest of the header bytes (for now)
            bstream.readBytes(this.headSize - 7);
            break;
    }
};

module.exports = RarVolumeHeader;

  };

  __modules['RarUnpack15'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */
var RarEventMgr = require("./RarEventMgr");

// TODO: implement
function Unpack15(bstream, Solid) {
    RarEventMgr.emitError("ERROR!  RAR 1.5 compression not supported");
}

module.exports = Unpack15;

  };

  __modules['RarUnpack20'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */

/*****************************************************************
 * Libs
 *****************************************************************/
var RarUtils = require("./RarUtils");

/*****************************************************************
 * vars
 *****************************************************************/

function Unpack20(bstream, Solid) {
    var destUnpSize = RarUtils.BUFFERS.unpack.data.length;
    var oldDistPtr = 0;

    RarReadTables20(bstream);
    while (destUnpSize > RarUtils.BUFFERS.unpack.ptr) {
        var num = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.LD);
        if (num < 256) {
            RarUtils.BUFFERS.unpack.insertByte(num);
            continue;
        }
        if (num > 269) {
            var Length = RarUtils.CONST.rLDecode[num -= 270] + 3;
            if ((Bits = RarUtils.CONST.rLBits[num]) > 0) {
                Length += bstream.readBits(Bits);
            }
            var DistNumber = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.DD);
            var Distance = RarUtils.CONST.rDDecode[DistNumber] + 1;
            if ((Bits = RarUtils.CONST.rDBits[DistNumber]) > 0) {
                Distance += bstream.readBits(Bits);
            }
            if (Distance >= 0x2000) {
                Length++;
                if (Distance >= 0x40000) Length++;
            }
            lastLength = Length;
            lastDist = rOldDist[oldDistPtr++ & 3] = Distance;
            RarUtils.RarCopyString(Length, Distance);
            continue;
        }
        if (num == 269) {
            RarReadTables20(bstream);

            RarUtils.RarUpdateProgress();

            continue;
        }
        if (num == 256) {
            lastDist = rOldDist[oldDistPtr++ & 3] = lastDist;
            RarUtils.RarCopyString(lastLength, lastDist);
            continue;
        }
        if (num < 261) {
            var Distance = rOldDist[(oldDistPtr - (num - 256)) & 3];
            var LengthNumber = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.RD);
            var Length = RarUtils.CONST.rLDecode[LengthNumber] + 2;
            if ((Bits = RarUtils.CONST.rLBits[LengthNumber]) > 0) {
                Length += bstream.readBits(Bits);
            }
            if (Distance >= 0x101) {
                Length++;
                if (Distance >= 0x2000) {
                    Length++
                    if (Distance >= 0x40000) Length++;
                }
            }
            lastLength = Length;
            lastDist = rOldDist[oldDistPtr++ & 3] = Distance;
            RarUtils.RarCopyString(Length, Distance);
            continue;
        }
        if (num < 270) {
            var Distance = RarUtils.CONST.rSDDecode[num -= 261] + 1;
            if ((Bits = RarUtils.CONST.rSDBits[num]) > 0) {
                Distance += bstream.readBits(Bits);
            }
            lastLength = 2;
            lastDist = rOldDist[oldDistPtr++ & 3] = Distance;
            RarUtils.RarCopyString(2, Distance);
            continue;
        }

    }
    RarUtils.RarUpdateProgress();
}

var rNC20 = 298,
    rDC20 = 48,
    rRC20 = 28,
    rBC20 = 19,
    rMC20 = 257;

var UnpOldTable20 = new Array(rMC20 * 4);

function RarReadTables20(bstream) {
    var BitLength = new Array(rBC20);
    var Table = new Array(rMC20 * 4);
    var TableSize, N, I;
    var AudioBlock = bstream.readBits(1);
    if (!bstream.readBits(1))
        for (var i = UnpOldTable20.length; i--;) UnpOldTable20[i] = 0;
    TableSize = rNC20 + rDC20 + rRC20;
    for (var I = 0; I < rBC20; I++)
        BitLength[I] = bstream.readBits(4);
    RarUtils.RarMakeDecodeTables(BitLength, 0, RarUtils.CONST.BD, rBC20);
    I = 0;
    while (I < TableSize) {
        var num = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.BD);
        if (num < 16) {
            Table[I] = num + UnpOldTable20[I] & 0xf;
            I++;
        } else if (num == 16) {
            N = bstream.readBits(2) + 3;
            while (N-- > 0 && I < TableSize) {
                Table[I] = Table[I - 1];
                I++;
            }
        } else {
            if (num == 17) {
                N = bstream.readBits(3) + 3;
            } else {
                N = bstream.readBits(7) + 11;
            }
            while (N-- > 0 && I < TableSize) {
                Table[I++] = 0;
            }
        }
    }
    RarUtils.RarMakeDecodeTables(Table, 0, RarUtils.CONST.LD, rNC20);
    RarUtils.RarMakeDecodeTables(Table, rNC20, RarUtils.CONST.DD, rDC20);
    RarUtils.RarMakeDecodeTables(Table, rNC20 + rDC20, RarUtils.CONST.RD, rRC20);
    for (var i = UnpOldTable20.length; i--;) UnpOldTable20[i] = Table[i];
}

module.exports = Unpack20;

  };

  __modules['RarUnpack29'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */

/*****************************************************************
 * Libs
 *****************************************************************/
var RarUtils = require("./RarUtils"),
    RarEventMgr = require("./RarEventMgr");

/*****************************************************************
 * vars
 *****************************************************************/

var rLOW_DIST_REP_COUNT = 16;

var lowDistRepCount = 0,
    prevLowDist = 0;

// unused
var BLOCK_LZ = 0,
    BLOCK_PPM = 1;

var rOldDist = [0, 0, 0, 0];
var lastDist;
var lastLength;

var UnpBlockType = BLOCK_LZ; // unused ?
var UnpOldTable = new Array(RarUtils.CONST.rHUFF_TABLE_SIZE);

function Unpack29(bstream, Solid) {
    // lazy initialize RarUtils.CONST.rDDecode and RarUtils.CONST.rDBits

    var DDecode = new Array(RarUtils.CONST.rDC);
    var DBits = new Array(RarUtils.CONST.rDC);

    var Dist = 0,
        BitLength = 0,
        Slot = 0;

    for (var I = 0; I < RarUtils.CONST.rDBitLengthCounts.length; I++, BitLength++) {
        for (var J = 0; J < RarUtils.CONST.rDBitLengthCounts[I]; J++, Slot++, Dist += (1 << BitLength)) {
            DDecode[Slot] = Dist;
            DBits[Slot] = BitLength;
        }
    }

    var Bits;
    //tablesRead = false;

    rOldDist = [0, 0, 0, 0]

    lastDist = 0;
    lastLength = 0;

    for (var i = UnpOldTable.length; i--;) UnpOldTable[i] = 0;

    // read in Huffman tables
    RarReadTables(bstream);

    while (true) {
        var num = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.LD);

        if (num < 256) {
            RarUtils.BUFFERS.unpack.insertByte(num);
            continue;
        }
        if (num >= 271) {
            var Length = RarUtils.CONST.rLDecode[num -= 271] + 3;
            if ((Bits = RarUtils.CONST.rLBits[num]) > 0) {
                Length += bstream.readBits(Bits);
            }
            var DistNumber = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.DD);
            var Distance = DDecode[DistNumber] + 1;
            if ((Bits = DBits[DistNumber]) > 0) {
                if (DistNumber > 9) {
                    if (Bits > 4) {
                        Distance += ((bstream.getBits() >>> (20 - Bits)) << 4);
                        bstream.readBits(Bits - 4);
                        //todo: check this
                    }
                    if (lowDistRepCount > 0) {
                        lowDistRepCount--;
                        Distance += prevLowDist;
                    } else {
                        var LowDist = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.LDD);
                        if (LowDist == 16) {
                            lowDistRepCount = rLOW_DIST_REP_COUNT - 1;
                            Distance += prevLowDist;
                        } else {
                            Distance += LowDist;
                            prevLowDist = LowDist;
                        }
                    }
                } else {
                    Distance += bstream.readBits(Bits);
                }
            }
            if (Distance >= 0x2000) {
                Length++;
                if (Distance >= 0x40000) {
                    Length++;
                }
            }
            RarInsertOldDist(Distance);
            RarInsertLastMatch(Length, Distance);
            RarUtils.RarCopyString(Length, Distance);
            continue;
        }
        if (num == 256) {
            if (!RarReadEndOfBlock(bstream)) break;

            continue;
        }
        if (num == 257) {
            //console.log("READVMCODE");
            if (!RarReadVMCode(bstream)) break;
            continue;
        }
        if (num == 258) {
            if (lastLength != 0) {
                RarUtils.RarCopyString(lastLength, lastDist);
            }
            continue;
        }
        if (num < 263) {
            var DistNum = num - 259;
            var Distance = rOldDist[DistNum];

            for (var I = DistNum; I > 0; I--) {
                rOldDist[I] = rOldDist[I - 1];
            }
            rOldDist[0] = Distance;

            var LengthNumber = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.RD);
            var Length = RarUtils.CONST.rLDecode[LengthNumber] + 2;
            if ((Bits = RarUtils.CONST.rLBits[LengthNumber]) > 0) {
                Length += bstream.readBits(Bits);
            }
            RarInsertLastMatch(Length, Distance);
            RarUtils.RarCopyString(Length, Distance);
            continue;
        }
        if (num < 272) {
            var Distance = RarUtils.CONST.rSDDecode[num -= 263] + 1;
            if ((Bits = RarUtils.CONST.rSDBits[num]) > 0) {
                Distance += bstream.readBits(Bits);
            }
            RarInsertOldDist(Distance);
            RarInsertLastMatch(2, Distance);
            RarUtils.RarCopyString(2, Distance);
            continue;
        }
    }

    RarUtils.RarUpdateProgress();
}

function RarInsertLastMatch(length, distance) {
    lastDist = distance;
    lastLength = length;
}

function RarInsertOldDist(distance) {
    rOldDist.splice(3, 1);
    rOldDist.splice(0, 0, distance);
}

function RarReadVMCode(bstream) {
    var FirstByte = bstream.readBits(8);
    var Length = (FirstByte & 7) + 1;
    if (Length == 7) {
        Length = bstream.readBits(8) + 7;
    } else if (Length == 8) {
        Length = bstream.readBits(16);
    }
    var vmCode = [];
    for (var I = 0; I < Length; I++) {
        //do something here with cheking readbuf
        vmCode.push(bstream.readBits(8));
    }
    return RarAddVMCode(FirstByte, vmCode, Length);
}

function RarAddVMCode(firstByte, vmCode, length) {
    //console.log(vmCode);
    if (vmCode.length > 0) {
        RarEventMgr.emitInfo("Error! RarVM not supported yet!"); // we don't want to trigger an error for this one since it's not fatal
    }
    return true;
}

function RarReadEndOfBlock(bstream) {

    RarUtils.RarUpdateProgress();

    var NewTable = false,
        NewFile = false;
    if (bstream.readBits(1)) {
        NewTable = true;
    } else {
        NewFile = true;
        NewTable = !!bstream.readBits(1);
    }
    //tablesRead = !NewTable;
    return !(NewFile || NewTable && !RarReadTables(bstream));
}

// read in Huffman tables for RAR
function RarReadTables(bstream) {
    var BitLength = new Array(RarUtils.CONST.rBC),
        Table = new Array(RarUtils.CONST.rHUFF_TABLE_SIZE);

    // before we start anything we need to get byte-aligned
    bstream.readBits((8 - bstream.bitPtr) & 0x7);

    if (bstream.readBits(1)) {
        console.info("Error!  PPM not implemented yet");
        return;
    }

    if (!bstream.readBits(1)) { //discard old table
        for (var i = UnpOldTable.length; i--;) UnpOldTable[i] = 0;
    }

    // read in bit lengths
    for (var I = 0; I < RarUtils.CONST.rBC; ++I) {

        var Length = bstream.readBits(4);
        if (Length == 15) {
            var ZeroCount = bstream.readBits(4);
            if (ZeroCount == 0) {
                BitLength[I] = 15;
            } else {
                ZeroCount += 2;
                while (ZeroCount-- > 0 && I < RarUtils.CONST.rBC)
                    BitLength[I++] = 0;
                --I;
            }
        } else {
            BitLength[I] = Length;
        }
    }

    // now all 20 bit lengths are obtained, we construct the Huffman Table:

    RarUtils.RarMakeDecodeTables(BitLength, 0, RarUtils.CONST.BD, RarUtils.CONST.rBC);

    var TableSize = RarUtils.CONST.rHUFF_TABLE_SIZE;
    //console.log(DecodeLen, DecodePos, DecodeNum);
    for (var i = 0; i < TableSize;) {
        var num = RarUtils.RarDecodeNumber(bstream, RarUtils.CONST.BD);
        if (num < 16) {
            Table[i] = (num + UnpOldTable[i]) & 0xf;
            i++;
        } else if (num < 18) {
            var N = (num == 16) ? (bstream.readBits(3) + 3) : (bstream.readBits(7) + 11);

            while (N-- > 0 && i < TableSize) {
                Table[i] = Table[i - 1];
                i++;
            }
        } else {
            var N = (num == 18) ? (bstream.readBits(3) + 3) : (bstream.readBits(7) + 11);

            while (N-- > 0 && i < TableSize) {
                Table[i++] = 0;
            }
        }
    }

    RarUtils.RarMakeDecodeTables(Table, 0, RarUtils.CONST.LD, RarUtils.CONST.rNC);
    RarUtils.RarMakeDecodeTables(Table, RarUtils.CONST.rNC, RarUtils.CONST.DD, RarUtils.CONST.rDC);
    RarUtils.RarMakeDecodeTables(Table, RarUtils.CONST.rNC + RarUtils.CONST.rDC, RarUtils.CONST.LDD, RarUtils.CONST.rLDC);
    RarUtils.RarMakeDecodeTables(Table, RarUtils.CONST.rNC + RarUtils.CONST.rDC + RarUtils.CONST.rLDC, RarUtils.CONST.RD, RarUtils.CONST.rRC);

    for (var i = UnpOldTable.length; i--;) {
        UnpOldTable[i] = Table[i];
    }
    return true;
}

module.exports = Unpack29;

  };

  __modules['RarUnpack'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */

/*****************************************************************
 * Libs
 *****************************************************************/
var BitStream = require("./BitStream"),
    ByteBuffer = require("./ByteBuffer"),
    RarUtils = require( "./RarUtils"),
    RarEventMgr = require( "./RarEventMgr"),
    Unpack15 = require("./RarUnpack15"),
    Unpack20 = require("./RarUnpack20"),
    Unpack29 = require("./RarUnpack29");

/*****************************************************************
 * vars
 *****************************************************************/

// v must be a valid RarVolume
function unpack(rarVolume) {

    // TODO: implement what happens when unpVer is < 15
    var Ver = rarVolume.header.unpVer <= 15 ? 15 : rarVolume.header.unpVer,
        Solid = rarVolume.header.LHD_SOLID,
        bstream = new BitStream(rarVolume.fileData.buffer, true /* rtl */ , rarVolume.fileData.byteOffset, rarVolume.fileData.byteLength);

    RarUtils.BUFFERS.unpack = new ByteBuffer(rarVolume.header.unpackedSize);

    RarEventMgr.emitInfo("Unpacking " + rarVolume.filename + " RAR v" + Ver);

    switch (Ver) {
        case 15: // rar 1.5 compression
            Unpack15(bstream, Solid);
            break;
        case 20: // rar 2.x compression
        case 26: // files larger than 2GB
            Unpack20(bstream, Solid);
            break;
        case 29: // rar 3.x compression
        case 36: // alternative hash
            Unpack29(bstream, Solid);
            break;
    } // switch(method)

    RarUtils.BUFFERS.oldBuffers.push(RarUtils.BUFFERS.unpack);

    //TODO: clear these old buffers when there's over 4MB of history
    return RarUtils.BUFFERS.unpack.data;
}

module.exports = unpack;

  };

  __modules['RarLocalFile'] = function (module, exports, require) {
/**
 * unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */

var ByteBuffer = require("./ByteBuffer"),
    RarUtils = require("./RarUtils"),
    RarEventMgr = require("./RarEventMgr"),
    RarVolumeHeader = require("./RarVolumeHeader"),
    Unpack = require("./RarUnpack");

// bstream is a bit stream
function RarLocalFile(bstream) {
    this.header = new RarVolumeHeader(bstream);
    this.filename = this.header.filename;

    if (this.header.headType != RarUtils.VOLUME_TYPES.FILE_HEAD && this.header.headType != RarUtils.VOLUME_TYPES.ENDARC_HEAD) {
        this.isValid = false;
        RarEventMgr.error("Error! RAR Volume did not include a FILE_HEAD header ");
    } else {
        // read in the compressed data
        this.fileData = null;
        if (this.header.packSize > 0) {
            this.fileData = bstream.readBytes(this.header.packSize);
            this.isValid = true;
        }
    }
};

RarLocalFile.prototype.unrar = function() {
    if (!this.header.flags.LHD_SPLIT_BEFORE) {
        // unstore file -- 0x30 -> 48 Decimal -> means that there's no compression in archive, just storing
        if (this.header.method == 0x30) {
            RarEventMgr.emitInfo("Unstore " + this.filename); // **** NEEDS NOTIFICATION REPORTER
            this.isValid = true;

            RarUtils.PROGRESS.currentBytesUnarchivedInFile += this.fileData.length;
            RarUtils.PROGRESS.currentBytesUnarchived += this.fileData.length;

            // Create a new buffer and copy it over.
            var len = this.header.packSize,
                newBuffer = new ByteBuffer(len);

            newBuffer.insertBytes(this.fileData);
            this.fileData = newBuffer.data;
        } else {
            this.isValid = true;
            this.fileData = Unpack(this);
        }
    }
}

module.exports = RarLocalFile;

  };

  __modules['Unrar'] = function (module, exports, require) {
/**
 * Unrar.js
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 * Copyright(c) 2016 Thomas Lanteigne -- code porting
 *
 * Reference Documentation:
 *
 * http://kthoom.googlecode.com/hg/docs/unrar.html
 */

var BitStream = require("./BitStream"),
    RarVolumeHeader = require("./RarVolumeHeader"),
    RarLocalFile = require("./RarLocalFile"),
    RarUtils = require("./RarUtils"),
    RarEventMgr = require("./RarEventMgr");

// Helper functions.
// var info = function(str) {
//     postMessage(new bitjs.archive.UnarchiveInfoEvent(str));
// };
// var err = function(str) {
//     postMessage(new bitjs.archive.UnarchiveErrorEvent(str));
// };
// var postProgress = function() {
//     postMessage(new bitjs.archive.UnarchiveProgressEvent(
//         RarUtils.PROGRESS.currentFilename,
//         RarUtils.PROGRESS.currentFileNumber,
//         RarUtils.PROGRESS.currentBytesUnarchivedInFile,
//         RarUtils.PROGRESS.currentBytesUnarchived,
//         RarUtils.PROGRESS.totalUncompressedBytesInArchive,
//         RarUtils.PROGRESS.totalFilesInArchive));
// };



RarUtils.reset(); // make sure we flush all tracking variables

function unrar(arrayBuffer) {
    RarEventMgr.emitStart();

    var bstream = new BitStream(arrayBuffer, false /* rtl */ );

    var header = new RarVolumeHeader(bstream);
    if (header.crc == 0x6152 &&
        header.headType == 0x72 &&
        header.flags.value == 0x1A21 &&
        header.headSize == 7) {
        RarEventMgr.emitInfo("Found RAR signature");

        var mhead = new RarVolumeHeader(bstream);
        if (mhead.headType != RarUtils.VOLUME_TYPES.MAIN_HEAD) {
            RarEventMgr.emitError("Error! RAR did not include a MAIN_HEAD header");
        } else {
            var localFiles = [],
                localFile = null;
            do {
                try {
                    localFile = new RarLocalFile(bstream);
                    RarEventMgr.emitInfo("RAR localFile isValid=" + localFile.isValid + ", volume packSize=" + localFile.header.packSize);
                    if (localFile && localFile.isValid && localFile.header.packSize > 0) {
                        RarUtils.PROGRESS.totalUncompressedBytesInArchive += localFile.header.unpackedSize;
                        localFiles.push(localFile);
                    } else if (localFile.header.packSize == 0 && localFile.header.unpackedSize == 0) {
                        localFile.isValid = true;
                    }
                } catch (err) {
                    break;
                }
                RarEventMgr.emitInfo("bstream" + bstream.bytePtr + "/" + bstream.bytes.length);
            } while (localFile.isValid);

            RarUtils.PROGRESS.totalFilesInArchive = localFiles.length;

            // now we have all console.information but things are unpacked
            // TODO: unpack
            localFiles = localFiles.sort(function(a, b) {
                var aname = a.filename;
                var bname = b.filename;
                return aname > bname ? 1 : -1;
            });

            RarEventMgr.emitInfo(localFiles.map(function(a) {
                return a.filename
            }).join(', '));

            for (var i = 0; i < localFiles.length; ++i) {
                var localfile = localFiles[i];

                RarEventMgr.emitInfo("Local file: ", localfile.filename);
                // update progress
                RarUtils.PROGRESS.currentFilename = localfile.header.filename;
                RarUtils.PROGRESS.currentBytesUnarchivedInFile = 0;

                // actually do the unzipping
                localfile.unrar();

                if (localfile.isValid) {
                    // notify extract event with file
                    RarEventMgr.emitExtract(localfile);
                    RarEventMgr.emitProgress(RarUtils.PROGRESS);
                }
            }

            RarEventMgr.emitProgress(RarUtils.PROGRESS);
        }
    } else {
        RarEventMgr.emitError("Invalid RAR file");
    }

    RarEventMgr.emitFinish(localFiles);

    return localFiles;
};

module.exports = unrar;

  };

  // Public API: UnrarLite(arrayBuffer) -> Array<{ filename, fileData: Uint8Array }>
  global.UnrarLite = __require('Unrar');
})(typeof window !== 'undefined' ? window : this);
