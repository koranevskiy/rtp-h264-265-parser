# rtp-h264-265-parser
TypeScript RTP H264/H265 Parser

## Example
```
import { RTPPacket } from 'test'
import { RTPH264Parser } from 'test'

// your code to recieve rtp packets

const h264Parser = new RTPH264Parser()

function(dgramma: Uint8Array) {
    const rtpPacket = new RTPPacket(dgramma)
    const accessUnit = h264Parser.extractAccessUnit(rtpPacket)
    if(!accessUnit) {
        return null
    }
    // pass access unit to h264 decoder (for example ffmpeg or ffmpeg wasm for browser) to recieve raw frame 
}

```