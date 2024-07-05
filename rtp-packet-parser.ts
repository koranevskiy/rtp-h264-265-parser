class RTPPacket {
    /**
     * RTP version (2 bits)
     */
    version: number
    /**
     * Packet contains additional bytes for alignment (1 bit)
     */
    padding: number
    /**
     * Has extension header after CSRC (1 bit)
     */
    extension: number
    /**
     * CSRC quantity after main headers (4 bits)
     */
    csrcCount: number
    /**
     * Important of packet for synchronization (1 bit)
     */
    marker: number
    /**
     * Format of RTP payload (7 bits)
     */
    payloadType: number
    /**
     * Number of packet which was sent, increased by one for each RTP packet (16 bits)
     */
    sequenceNumber: number
    /**
     * Time when packet was created (32 bits)
     */
    timestamp: number
    /**
     * The SSRC field identifies the synchronization source (32 bits)
     */
    ssrc: number
    /**
     * The CSRS 0 to 15 items, (32 bits each)
     */
    csrs: number[]

    /**
     *  Header length in bytes
     */
    headerLength: number
    /**
     * Additional header if marker set to 1
     */
    extensionHeader: {
        /**
         * profile of extension
         */
        profile: number
        /**
         * length of extension
         */
        length: number
    }
    constructor(private readonly buffer: Uint8Array) {
        this.version = (buffer[0] >> 6) & 0x03
        this.padding = (buffer[0] >> 5) & 0x01
        this.extension = (buffer[0] >> 4) & 0x01
        this.csrcCount = buffer[0] & 0x0F
        this.marker = (buffer[1] >> 7) & 0x01
        this.payloadType = buffer[1] & 0x7F
        this.sequenceNumber = (buffer[2] << 8) | buffer[3]
        this.timestamp = (buffer[4] << 24) | (buffer[5] << 16) | (buffer[6] << 8) | buffer[7]
        this.ssrc = (buffer[8] << 24) | (buffer[9] << 16) | (buffer[10] << 8) | buffer[11]
        for (let i = 0; i < this.csrcCount; i++) {
            this.csrs.push((buffer[12 + 4 * i] << 24) | (buffer[13 + 4 * i] << 16) | (buffer[14 + 4 * i] << 8) | buffer[15 + 4 * i])
        }
        this.headerLength = 12 + 4 * this.csrcCount

        if (this.extension) {
            const extOffset = this.headerLength
            this.extensionHeader = {
                profile: (buffer[extOffset] << 8) | buffer[extOffset + 1],
                length: (buffer[extOffset + 2] << 8) | buffer[extOffset + 3],
            };
            this.headerLength += 4 + this.extensionHeader.length * 4
        }
    }

    /**
     * Return RTP payload
     */
    public getPayload() {
        let payload = this.buffer.slice(this.headerLength)

        if (this.padding) {
            const paddingAmount = payload[payload.length - 1]
            payload = payload.slice(0, -paddingAmount)
        }

        return payload;
    }
}

export { RTPPacket }