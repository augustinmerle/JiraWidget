/**
	SoapSpoofer.js 
	beta version 1.0
	JavaScript class for creating a SOAP formatted envelope request.
	This object was originally designed to spoof SOAP packets from web pages,
	I added the needed functions to make it work with Konfabulator.

	Design & Code::	Mike Spisak / mspisak@pb.net 

	Usage:: 
	This program is free software; You are granted the right to use 
	and/or redistribute this code under the terms of the GNU General 
	Public License.
	This program is distributed in the hope that it will be useful, 
	but WITHOUT ANY WARRANTY; without even the implied warranty of 
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. The author
	makes no warranty.
**/

/* 
	SoapSpoofer... horray! 
	main javaScript constructor 
*/
function SoapSpoofer( SOAPaddress, serviceID, methodName ) {
	this.SOAPaddy = SOAPaddress;
	this.serviceID = serviceID;
	this.methodName = methodName;
	this.globalCounter = 0;
	this.HTTPHeaders = " -H 'Content-Type: text/xml' ";
	this.SOAPfile = "";
	this.properties = { 
		set : function( index, indexValue ) { this[index] = indexValue; },
		get : function( index ) { return this[index]; }
	}
	this.addHTTPHeader("SOAPAction" , serviceID + "#" + methodName);
}

/* 
	addProperty
	adds properties to the SOAP request 
*/
function _SoapSpoofer_addProperty( name, value ) { 
	if ( arguments.length > 0 ) { 
		this.properties.set( this.globalCounter, Array(name, value) );
		this.globalCounter++;
	} 
}

/* 
	getEnvelope
	generates the actual "SOAP envelope" .. this is the kludge 
*/
function _SoapSpoofer_getEnvelope() {

	var methodName = this.methodName;
	var serviceID = this.serviceID;
  
	// assemble the SOAP message header..
	var envelopeHeader = '<SOAP-ENV:Envelope xmlns:xsi="http://www.w3.org/1999/XMLSchema-instance" xmlns:xsd="http://www.w3.org/1999/XMLSchema" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">\n';
	envelopeHeader += '	<SOAP-ENV:Body SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\n';

	// assemble thhe SOAP message footer..
	var envelopeFooter = '	</SOAP-ENV:Body>\n';
	envelopeFooter += '</SOAP-ENV:Envelope>\n';
	
	// now, loop over individual parameters..
	var propName = "";
	var propValue = "";
	var soapBody = "<" + methodName + " xmlns=\"" + serviceID + "\" id=\"o0\" SOAP-ENC:root=\"1\">\n";
	
	for ( var i = 0; i < this.globalCounter; i++ ) {
		propName = this.properties[i][0];
		propValue = this.properties[i][1];
		soapBody += "<" + propName + " xmlns=\"\" xsi:type=\"" + _SoapSpoofer_identifyDataType( propValue ) + "\">" + propValue + "</" + propName + ">\n";
	}
	
	soapBody += "</" + methodName + ">";
  
	return envelopeHeader + soapBody + envelopeFooter;
}

/* 
	This function tries to identify the data types being passed to it..
	for now, we only support the basic of types (string, int)
*/
function _SoapSpoofer_identifyDataType(data) {
	// identifies the data type
	var dType = typeof(data);
	dType = dType.toLowerCase();
	switch(dType){
		case "number":
			if (Math.round(data) == data) {
				type = "xsd:int";
			} else {
				type = "xsd:double";
			}
			break;
		case "string":
			type = "xsd:string";
			break;			
		// will need to come back to this to format more complex objects..
		case "object":
			var construct = data.constructor;
			if ( construct == Date ) {
				type = "xsd:date";
			}
			// will need to come back to this for more complext types..
			// arrays, etc..
			break;
	}
	return type;
}

/* 
	addHTTPHeader
	this function adds HTTP headers to the curl request
*/
function _SoapSpoofer_addHTTPHeader(headerName, headerValue) {
	this.HTTPHeaders += " -H '" + headerName + ": " + headerValue + "' ";
}

/* 
	writeTempFile
	used to create a temp file that holds the generated SOAP packet.
	**work-around: the execution of the 'curl' command by konfabulator got 
		confused by the XML <> - so we write to a file and pass that in..
*/
function _SoapSpoofer_writeTempFile() {
	var tmpNow = new Date();
	tmpNow = tmpNow.getMilliseconds(); // make some temp name up..
	this.SOAPfile = system.temporaryFolder + "/" + String( tmpNow ) + ".tmp";
	filesystem.writeFile( this.SOAPfile, this.getEnvelope() );
}

/*
	basicAuthentication
	this function uses a Base64 encoding scheme to add 
	HTTP basic authentication headers to the SOAP request..
		* I used a base64 implementation that was ported to JavaScript
		* a long time ago.. cannot recall who credit goes to...
*/
function _SoapSpoofer_basicAuth(userID, passWord) {

	var strMain = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	var strEncode = userID + ":" + passWord;
	var result = "";
	var chr1, chr2, chr3;
	var enc1, enc2, enc3, enc4;
	var i = 0;

	while ( i < strEncode.length ) {
		chr1 = strEncode.charCodeAt(i++);
		chr2 = strEncode.charCodeAt(i++);
		chr3 = strEncode.charCodeAt(i++);
	
		enc1 = chr1 >> 2;
		enc2 = ( ( chr1 & 3 ) << 4 ) | ( chr2 >> 4 );
		enc3 = ( ( chr2 & 15 ) << 2 ) | ( chr3 >> 6 );
		enc4 = chr3 & 63;
	
		if ( isNaN( chr2 ) ) {
			enc3 = enc4 = 64;
		} else if ( isNaN( chr3 ) ) {
			enc4 = 64;
		}
		result += strMain.charAt(enc1) + strMain.charAt(enc2) + 
			strMain.charAt(enc3) + strMain.charAt(enc4);
	}
	this.addHTTPHeader( "Authorization", "Basic " + result );
}

/*
	makeCall
	this function actually executes the 'curl' command and 
	sends the results back as a string
*/
function _SoapSpoofer_makeCall() {
	this.writeTmpFile();
	var command = "curl -s ";
	command += this.SOAPaddy;
	command += this.HTTPHeaders;
	command += " -d @" + this.SOAPfile;
	var result = runCommand( command );
	if ( system.platform == "macintosh" ) {
		filesystem.moveToTrash( this.SOAPfile );
	} else {
		filesystem.moveToRecycleBin( this.SOAPfile );
	}
	return result;
}

/* build the SoapSpoofer structure and methods to expose */
SoapSpoofer.prototype = new Object();
SoapSpoofer.prototype.addProperty = _SoapSpoofer_addProperty;
SoapSpoofer.prototype.getEnvelope = _SoapSpoofer_getEnvelope;
SoapSpoofer.prototype.addHTTPHeader = _SoapSpoofer_addHTTPHeader;
SoapSpoofer.prototype.writeTmpFile = _SoapSpoofer_writeTempFile;
SoapSpoofer.prototype.basicAuthentication = _SoapSpoofer_basicAuth;
SoapSpoofer.prototype.call = _SoapSpoofer_makeCall;

