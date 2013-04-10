class window.Exif
  @TAGS = (() ->
          json = null
          $.ajax({
              async: false,
              global: false,
              url: "../res/tifftags.json",
              dataType: "json",
              success: (data) -> json = data;
          })
          json)()

  constructor: (@buffer) ->
    @view = new DataView(@buffer)

    ifd0Offset = @findOffsetOfFirstIfdInExif()
    console.log 'ifd0', ifd0Offset

    @tags = @readIfd(ifd0Offset)
    console.log 'tags', @tags    

    #$.getJSON "http://anyorigin.com/get?url=#{encodeURIComponent('http://www.awaresystems.be/')}&callback=?", (data) ->
    #  console.log data.contents
    
  findMarker: (id) ->
    marker = @view.getUint16(0)
    isMarker = marker == 0xffd8 # SOI
    offset = 2

    while isMarker and offset < @view.byteLength
      isMarker = @view.getUint8(offset) == 0xff

      if isMarker
        marker = @view.getUint16(offset)
        size = @view.getUint16(offset + 2)
        
        console.log "next marker is 0x" + marker.toString(16) + " and is " + size + " bytes (including 'size' word)"
        if marker == id then return offset

        offset += size + 2

    # Not found
    -1

  findOffsetOfFirstIfdInExif: () ->
    if (offset = @findMarker(0xffe1)) < 0 then throw "APP1 marker not found"
    if (marker = @view.getUint16(offset)) != 0xffe1 then throw "Wrong marker, expected APP1 (0xffe1)"

    size = @view.getUint16(offset + 2)
    exifHeader = @view.getUint32(offset + 4) + @view.getUint16(offset + 8)

    unless exifHeader == 0x45786966 then throw "Wrong Exif header" # 'Exif'00

    offset += 10 # Points at TIFF header
    isLittleEndian = @view.getUint16(offset) == 0x4949 # 'II' as in Intel

    unless @view.getUint16(offset + 2, isLittleEndian) == 0x2a then throw "Expected '0x2A' in TIFF header"

    ifdOffset = offset + @view.getUint32(offset + 2 + 2, isLittleEndian)
    
    {tiffOffset: offset, offset: ifdOffset, littleEndian : isLittleEndian}
    
  readIfd: (ifd) ->
    offset = ifd.offset
    numOfDirEntries = @view.getUint16(offset, ifd.littleEndian)
    offset += 2

    tags = []
    for i in [0...numOfDirEntries] by 1
      tag = @readIfdTag ifd, offset      
      tags.push tag
      offset += 12

      switch tag.id 
        when 0x8769, 0x8825 then tags = tags.concat @readIfd {offset: tag.value + ifd.tiffOffset, tiffOffset: ifd.tiffOffset, littleEndian: ifd.littleEndian}

    nextIfd = @view.getUint32(offset)
    console.log ("Next Ifd starts at 0x" + nextIfd.toString(16))
    tags

  readIfdTag: (ifd, tagOffset) ->
    tagId = @view.getUint16(tagOffset, ifd.littleEndian)
    dataFormat = @view.getUint16(tagOffset + 2, ifd.littleEndian)
    numOfComponents = @view.getUint32(tagOffset + 4, ifd.littleEndian)    
    tagValue = 'Unknown'
    
    byteLength = switch dataFormat
      when 1, 2, 7 then numOfComponents
      when 3 then numOfComponents * 2 # unsigned short
      when 4 then numOfComponents * 4 # unsigned long
      when 5, 10 then numOfComponents * 8 # 'rational' two un/signed longs
      else 0

    if byteLength <= 4
      tagValue = switch dataFormat
        when 2 then String.fromCharCode.apply(null, new Int8Array(@buffer, tagOffset + 8, numOfComponents))
        when 3 then @view.getUint16(tagOffset + 8, ifd.littleEndian)
        when 4 then @view.getUint32(tagOffset + 8, ifd.littleEndian)
        when 1, 7
          for offset in [0...numOfComponents] by 1 then @view.getUint8(tagOffset + 8 + offset, ifd.littleEndian)
        else 'Unknown (small)'

    else
      dataOffset = ifd.tiffOffset + @view.getUint32(tagOffset + 8, ifd.littleEndian)

      tagValue = switch dataFormat
        when 2 then String.fromCharCode.apply(null, new Int8Array(@buffer, dataOffset, byteLength))
        when 3
          for offset in [dataOffset...dataOffset + byteLength] by 2 then @view.getUint16(offset, ifd.littleEndian)
        when 5 
          for offset in [dataOffset...dataOffset + byteLength] by 8 then @view.getUint32(offset, ifd.littleEndian) / @view.getUint32(offset + 4, ifd.littleEndian)
        when 10
          for offset in [dataOffset...dataOffset + byteLength] by 8 then @view.getInt32(offset, ifd.littleEndian) / @view.getInt32(offset + 4, ifd.littleEndian)
        else 'Unknown (offset)'

    if tagValue instanceof Array and tagValue.length == 1 then tagValue = tagValue[0]

    console.log "tagId=0x" + tagId.toString(16) + " format=" + dataFormat + " numOfComponents=" + numOfComponents + " value='" + tagValue + "' byteLength=" + byteLength
    # alert "tagId=0x" + tagId.toString(16) + " format=" + dataFormat + " numOfComponents=" + numOfComponents + " value='" + tagValue + "' byteLength=" + byteLength
    {id: tagId, value: tagValue, unz: Exif.TAGS[tagId]}
