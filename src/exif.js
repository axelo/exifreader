// Generated by CoffeeScript 1.6.2
(function() {
  window.Exif = (function() {
    Exif.TAGS = (function() {
      var json;

      json = null;
      $.ajax({
        async: false,
        global: false,
        url: "../res/tifftags.json",
        dataType: "json",
        success: function(data) {
          return json = data;
        }
      });
      return json;
    })();

    function Exif(buffer) {
      var ifd0Offset;

      this.buffer = buffer;
      this.view = new DataView(this.buffer);
      ifd0Offset = this.findOffsetOfFirstIfdInExif();
      console.log('ifd0', ifd0Offset);
      this.tags = this.readIfd(ifd0Offset);
      console.log('tags', this.tags);
    }

    Exif.prototype.findMarker = function(id) {
      var isMarker, marker, offset, size;

      marker = this.view.getUint16(0);
      isMarker = marker === 0xffd8;
      offset = 2;
      while (isMarker && offset < this.view.byteLength) {
        isMarker = this.view.getUint8(offset) === 0xff;
        if (isMarker) {
          marker = this.view.getUint16(offset);
          size = this.view.getUint16(offset + 2);
          console.log("next marker is 0x" + marker.toString(16) + " and is " + size + " bytes (including 'size' word)");
          if (marker === id) {
            return offset;
          }
          offset += size + 2;
        }
      }
      return -1;
    };

    Exif.prototype.findOffsetOfFirstIfdInExif = function() {
      var exifHeader, ifdOffset, isLittleEndian, marker, offset, size;

      if ((offset = this.findMarker(0xffe1)) < 0) {
        throw "APP1 marker not found";
      }
      if ((marker = this.view.getUint16(offset)) !== 0xffe1) {
        throw "Wrong marker, expected APP1 (0xffe1)";
      }
      size = this.view.getUint16(offset + 2);
      exifHeader = this.view.getUint32(offset + 4) + this.view.getUint16(offset + 8);
      if (exifHeader !== 0x45786966) {
        throw "Wrong Exif header";
      }
      offset += 10;
      isLittleEndian = this.view.getUint16(offset) === 0x4949;
      if (this.view.getUint16(offset + 2, isLittleEndian) !== 0x2a) {
        throw "Expected '0x2A' in TIFF header";
      }
      ifdOffset = offset + this.view.getUint32(offset + 2 + 2, isLittleEndian);
      return {
        tiffOffset: offset,
        offset: ifdOffset,
        littleEndian: isLittleEndian
      };
    };

    Exif.prototype.readIfd = function(ifd) {
      var i, nextIfd, numOfDirEntries, offset, tag, tags, _i;

      offset = ifd.offset;
      numOfDirEntries = this.view.getUint16(offset, ifd.littleEndian);
      offset += 2;
      tags = [];
      for (i = _i = 0; _i < numOfDirEntries; i = _i += 1) {
        tag = this.readIfdTag(ifd, offset);
        tags.push(tag);
        offset += 12;
        switch (tag.id) {
          case 0x8769:
          case 0x8825:
            tags = tags.concat(this.readIfd({
              offset: tag.value + ifd.tiffOffset,
              tiffOffset: ifd.tiffOffset,
              littleEndian: ifd.littleEndian
            }));
        }
      }
      nextIfd = this.view.getUint32(offset);
      console.log("Next Ifd starts at 0x" + nextIfd.toString(16));
      return tags;
    };

    Exif.prototype.readIfdTag = function(ifd, tagOffset) {
      var byteLength, dataFormat, dataOffset, numOfComponents, offset, tagId, tagValue;

      tagId = this.view.getUint16(tagOffset, ifd.littleEndian);
      dataFormat = this.view.getUint16(tagOffset + 2, ifd.littleEndian);
      numOfComponents = this.view.getUint32(tagOffset + 4, ifd.littleEndian);
      tagValue = 'Unknown';
      byteLength = (function() {
        switch (dataFormat) {
          case 1:
          case 2:
          case 7:
            return numOfComponents;
          case 3:
            return numOfComponents * 2;
          case 4:
            return numOfComponents * 4;
          case 5:
          case 10:
            return numOfComponents * 8;
          default:
            return 0;
        }
      })();
      if (byteLength <= 4) {
        tagValue = (function() {
          var _i, _results;

          switch (dataFormat) {
            case 2:
              return String.fromCharCode.apply(null, new Int8Array(this.buffer, tagOffset + 8, numOfComponents));
            case 3:
              return this.view.getUint16(tagOffset + 8, ifd.littleEndian);
            case 4:
              return this.view.getUint32(tagOffset + 8, ifd.littleEndian);
            case 1:
            case 7:
              _results = [];
              for (offset = _i = 0; _i < numOfComponents; offset = _i += 1) {
                _results.push(this.view.getUint8(tagOffset + 8 + offset, ifd.littleEndian));
              }
              return _results;
              break;
            default:
              return 'Unknown (small)';
          }
        }).call(this);
      } else {
        dataOffset = ifd.tiffOffset + this.view.getUint32(tagOffset + 8, ifd.littleEndian);
        tagValue = (function() {
          var _i, _j, _k, _ref, _ref1, _ref2, _results, _results1, _results2;

          switch (dataFormat) {
            case 2:
              return String.fromCharCode.apply(null, new Int8Array(this.buffer, dataOffset, byteLength));
            case 3:
              _results = [];
              for (offset = _i = dataOffset, _ref = dataOffset + byteLength; _i < _ref; offset = _i += 2) {
                _results.push(this.view.getUint16(offset, ifd.littleEndian));
              }
              return _results;
              break;
            case 5:
              _results1 = [];
              for (offset = _j = dataOffset, _ref1 = dataOffset + byteLength; _j < _ref1; offset = _j += 8) {
                _results1.push(this.view.getUint32(offset, ifd.littleEndian) / this.view.getUint32(offset + 4, ifd.littleEndian));
              }
              return _results1;
              break;
            case 10:
              _results2 = [];
              for (offset = _k = dataOffset, _ref2 = dataOffset + byteLength; _k < _ref2; offset = _k += 8) {
                _results2.push(this.view.getInt32(offset, ifd.littleEndian) / this.view.getInt32(offset + 4, ifd.littleEndian));
              }
              return _results2;
              break;
            default:
              return 'Unknown (offset)';
          }
        }).call(this);
      }
      if (tagValue instanceof Array && tagValue.length === 1) {
        tagValue = tagValue[0];
      }
      console.log("tagId=0x" + tagId.toString(16) + " format=" + dataFormat + " numOfComponents=" + numOfComponents + " value='" + tagValue + "' byteLength=" + byteLength);
      return {
        id: tagId,
        value: tagValue,
        unz: Exif.TAGS[tagId]
      };
    };

    return Exif;

  })();

}).call(this);

/*
//@ sourceMappingURL=exif.map
*/
