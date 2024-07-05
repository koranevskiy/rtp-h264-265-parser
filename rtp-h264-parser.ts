import { RTPPacket } from './rtp-packet-parser.ts'

class RTPH264Parser {

    extractAccessUnit(rtpPacket: Uint8Array) {
        const packet = new RTPPacket(rtpPacket)
        const nalu = packet.getPayload()
        const naluType = nalu[0] & 0x1F // Extract nalu type from payload (last 5 bits from first byte)
        switch (naluType) {
            case 0: // reserved in RFC spec
                return null
            case 30: // reserved in RFC spec
                return null
            case 31: // reserved in RFC spec
                return null
            case 24: // STAP-A
                return this.extractStapA(nalu)
            case 25: // STAP-B
                return this.extractStapBUnits(nalu).nalUnits
            case 26: // MTAP16
                return this.extractMTAP16Units(nalu).map(item => item.nalUnit)
            case 27: // MTAP24
                return this.extractMTAP24Units(nalu).map(item => item.nalUnit)
            case 28: // FU-A
                const fua = this.extractFUAUnits(nalu)
                if (fua.start || fua.end) {
                    return fua.nalUnit
                }
                return null;
            case 29: // FU-B
                const fub = this.extractFUBUnits(nalu)
                if (fub.start || fub.end) {
                    return fub.nalUnit
                }
                return null
            default: // Single nalu
                return this.extractSingleNalu(nalu)
        }
    }

    extractSingleNalu(payload: Uint8Array) {
        return payload
    }

    extractStapA(payload: Uint8Array) {
        // Extract NAL Units from STAP-A
        const nalUnits: Uint8Array[] = []
        let offset = 1
        while (offset < payload.length) {
            if (offset + 2 > payload.length) {
                throw new Error("Malformed STAP-A packet")
            }

            // Length of the NAL unit
            const nalUnitLength = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            if (offset + nalUnitLength > payload.length) {
                throw new Error("NAL unit length exceeds payload length")
            }

            // Extract NAL unit
            const nalUnit = payload.slice(offset, offset + nalUnitLength)
            nalUnits.push(nalUnit)
            offset += nalUnitLength
        }

        return nalUnits
    }

    extractStapBUnits(payload: Uint8Array) {
        // Extract DON (decoding order number)
        if (payload.length < 3) {
            throw new Error("Malformed STAP-B packet: missing DON and TS offset")
        }

        const dond = (payload[1] << 8) | payload[2]
        const tsOffset = (payload[3] << 8) | payload[4]

        const nalUnits: Uint8Array[] = []
        let offset = 5;  // Start after NAL header, DON, and TS offset

        while (offset < payload.length) {
            if (offset + 2 > payload.length) {
                throw new Error("Malformed STAP-B packet")
            }

            // Length of the NAL unit
            const nalUnitLength = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            if (offset + nalUnitLength > payload.length) {
                throw new Error("NAL unit length exceeds payload length")
            }

            // Extract NAL unit
            const nalUnit = payload.slice(offset, offset + nalUnitLength)
            nalUnits.push(nalUnit)
            offset += nalUnitLength
        }

        return {nalUnits, dond, tsOffset};
    }

    extractMTAP16Units(payload: Uint8Array): MTAPNALUnit[] {
        const nalUnits: MTAPNALUnit[] = []
        let offset = 1

        while (offset + 6 <= payload.length) {  // Ensure there is enough data for dond, tsOffset, and nalUnitLength
            // Extract DON (decoding order number)
            const dond = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            // Extract TS offset
            const tsOffset = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            // Length of the NAL unit
            const nalUnitLength = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            if (offset + nalUnitLength > payload.length) {
                throw new Error("NAL unit length exceeds payload length")
            }

            // Extract NAL unit
            const nalUnit = payload.slice(offset, offset + nalUnitLength)
            nalUnits.push({ dond, tsOffset, nalUnit })
            offset += nalUnitLength
        }

        if (offset !== payload.length) {
            throw new Error("Malformed MTAP16 packet")
        }

        return nalUnits
    }

    extractMTAP24Units(payload: Uint8Array): MTAPNALUnit[] {
        const nalUnits: MTAPNALUnit[] = []
        let offset = 1

        while (offset + 7 <= payload.length) {  // Ensure there is enough data for dond, tsOffset, and nalUnitLength
            // Extract DON (decoding order number)
            const dond = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            // Extract TS offset (24 bits)
            const tsOffset = (payload[offset] << 16) | (payload[offset + 1] << 8) | payload[offset + 2]
            offset += 3

            // Length of the NAL unit
            const nalUnitLength = (payload[offset] << 8) | payload[offset + 1]
            offset += 2

            if (offset + nalUnitLength > payload.length) {
                throw new Error("NAL unit length exceeds payload length")
            }

            // Extract NAL unit
            const nalUnit = payload.slice(offset, offset + nalUnitLength)
            nalUnits.push({ dond, tsOffset, nalUnit })
            offset += nalUnitLength
        }

        if (offset !== payload.length) {
            throw new Error("Malformed MTAP24 packet")
        }

        return nalUnits
    }

    extractFUAUnits(payload: Uint8Array): FUPacket {

        const nalHeader = payload[0]
        const fuIndicator = payload[1]

        const start = (fuIndicator & 0x80) !== 0
        const end = (fuIndicator & 0x40) !== 0
        const nri = (nalHeader & 0x60) >> 5
        const originalNalType = fuIndicator & 0x1F

        const reconstructedNalHeader = (nri << 5) | originalNalType
        const nalUnit = start
            ? new Uint8Array([reconstructedNalHeader, ...payload.slice(2)])
            : payload.slice(2)

        return { start, end, nalUnit }
    }

    extractFUBUnits(payload: Uint8Array): FUBPacket {
        const nalHeader = payload[0]
        const fuHeader = payload[1]
        const start = (fuHeader & 0x80) !== 0
        const end = (fuHeader & 0x40) !== 0
        const nri = (nalHeader & 0x60) >> 5
        const originalNalType = fuHeader & 0x1F

        const dond = (payload[2] << 8) | payload[3]
        const tsOffset = (payload[4] << 16) | (payload[5] << 8) | payload[6]

        const reconstructedNalHeader = (nri << 5) | originalNalType
        const nalUnit = start
            ? new Uint8Array([reconstructedNalHeader, ...payload.slice(7)])
            : payload.slice(7)

        return { start, end, dond, tsOffset, nalUnit }
    }

}

interface MTAPNALUnit {
    dond: number
    tsOffset: number
    nalUnit: Uint8Array
}

interface FUPacket {
    start: boolean
    end: boolean
    nalUnit: Uint8Array
}

interface FUBPacket {
    start: boolean
    end: boolean
    dond: number
    tsOffset: number
    nalUnit: Uint8Array
}

export { RTPH264Parser }