/*! jws-3.0.0 (c) 2013 Kenji Urushima | kjur.github.com/jsjws/license
 */
/*
 * jws.js - JSON Web Signature Class
 *
 * version: 3.0.0 (2013 Aug 27)
 *
 * Copyright (c) 2010-2013 Kenji Urushima (kenji.urushima@gmail.com)
 *
 * This software is licensed under the terms of the MIT License.
 * http://kjur.github.com/jsjws/license/
 *
 * The above copyright and license notice shall be 
 * included in all copies or substantial portions of the Software.
 */

/**
 * @fileOverview
 * @name jws-3.0.js
 * @author Kenji Urushima kenji.urushima@gmail.com
 * @version 3.0.0 (2013-Aug-27)
 * @since jsjws 1.0
 * @license <a href="http://kjur.github.io/jsjws/license/">MIT License</a>
 */

if (typeof KJUR == "undefined" || !KJUR) KJUR = {};
if (typeof KJUR.jws == "undefined" || !KJUR.jws) KJUR.jws = {};

/**
 * JSON Web Signature(JWS) class.<br/>
 * @class JSON Web Signature(JWS) class
 * @property {Dictionary} parsedJWS This property is set after JWS signature verification. <br/>
 *           Following "parsedJWS_*" properties can be accessed as "parsedJWS.*" because of
 *           JsDoc restriction.
 * @property {String} parsedJWS_headB64U string of Encrypted JWS Header
 * @property {String} parsedJWS_payloadB64U string of Encrypted JWS Payload
 * @property {String} parsedJWS_sigvalB64U string of Encrypted JWS signature value
 * @property {String} parsedJWS_si string of Signature Input
 * @property {String} parsedJWS_sigvalH hexadecimal string of JWS signature value
 * @property {String} parsedJWS_sigvalBI BigInteger(defined in jsbn.js) object of JWS signature value
 * @property {String} parsedJWS_headS string of decoded JWS Header
 * @property {String} parsedJWS_headS string of decoded JWS Payload
 * @author Kenji Urushima
 * @requires base64x.js, json-sans-eval.js and jsrsasign library
 * @see <a href="http://kjur.github.com/jsjws/">'jwjws'(JWS JavaScript Library) home page http://kjur.github.com/jsjws/</a>
 * @see <a href="http://kjur.github.com/jsrsasigns/">'jwrsasign'(RSA Sign JavaScript Library) home page http://kjur.github.com/jsrsasign/</a>
 * @see <a href="http://tools.ietf.org/html/draft-ietf-jose-json-web-algorithms-14">IETF I-D JSON Web Algorithms (JWA)</a>
 * @since jsjws 1.0
 * @description
 * <h4>Supported Algorithms</h4>
 * Here is supported algorithm names for {@link KJUR.jws.JWS.sign} and {@link KJUR.jws.JWS.verify}
 * methods.
 * <table>
 * <tr><th>alg value</th><th>spec requirement</th><th>jsjws support</th></tr>
 * <tr><td>HS256</td><td>REQUIRED</td><td>SUPPORTED</td></tr>
 * <tr><td>HS384</td><td>OPTIONAL</td><td>-</td></tr>
 * <tr><td>HS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS256</td><td>RECOMMENDED</td><td>SUPPORTED</td></tr>
 * <tr><td>RS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES256</td><td>RECOMMENDED+</td><td>SUPPORTED</td></tr>
 * <tr><td>ES384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES512</td><td>OPTIONAL</td><td>-</td></tr>
 * <tr><td>PS256</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>none</td><td>REQUIRED</td><td>SUPPORTED</td></tr>
 * </table>
 */
KJUR.jws.JWS = function() {

    // === utility =============================================================

    /**
     * parse JWS string and set public property 'parsedJWS' dictionary.<br/>
     * @name parseJWS
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sJWS JWS signature string to be parsed.
     * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
     * @throws if JWS Header is a malformed JSON string.
     * @since jws 1.1
     */
    this.parseJWS = function(sJWS, sigValNotNeeded) {
	if ((this.parsedJWS !== undefined) &&
	    (sigValNotNeeded || (this.parsedJWS.sigvalH !== undefined))) {
	    return;
	}
	if (sJWS.match(/^([^.]+)\.([^.]+)\.([^.]+)$/) == null) {
	    throw "JWS signature is not a form of 'Head.Payload.SigValue'.";
	}
	var b6Head = RegExp.$1;
	var b6Payload = RegExp.$2;
	var b6SigVal = RegExp.$3;
	var sSI = b6Head + "." + b6Payload;
	this.parsedJWS = {};
	this.parsedJWS.headB64U = b6Head;
	this.parsedJWS.payloadB64U = b6Payload;
	this.parsedJWS.sigvalB64U = b6SigVal;
	this.parsedJWS.si = sSI;

	if (!sigValNotNeeded) {
	    var hSigVal = b64utohex(b6SigVal);
	    var biSigVal = parseBigInt(hSigVal, 16);
	    this.parsedJWS.sigvalH = hSigVal;
	    this.parsedJWS.sigvalBI = biSigVal;
	}

	var sHead = b64utoutf8(b6Head);
	var sPayload = b64utoutf8(b6Payload);
	this.parsedJWS.headS = sHead;
	this.parsedJWS.payloadS = sPayload;

	if (! this.isSafeJSONString(sHead, this.parsedJWS, 'headP'))
	    throw "malformed JSON string for JWS Head: " + sHead;
    };

    // ==== JWS Validation =========================================================
    function _getSignatureInputByString(sHead, sPayload) {
	return utf8tob64u(sHead) + "." + utf8tob64u(sPayload);
    };

    function _getHashBySignatureInput(sSignatureInput, sHashAlg) {
	var hashfunc = function(s) { return KJUR.crypto.Util.hashString(s, sHashAlg); };
	if (hashfunc == null) throw "hash function not defined in jsrsasign: " + sHashAlg;
	return hashfunc(sSignatureInput);
    };

    function _jws_verifySignature(sHead, sPayload, hSig, hN, hE) {
	var sSignatureInput = _getSignatureInputByString(sHead, sPayload);
	var biSig = parseBigInt(hSig, 16);
	return _rsasign_verifySignatureWithArgs(sSignatureInput, biSig, hN, hE);
    };

    /**
     * verify JWS signature with naked RSA public key.<br/>
     * This only supports "RS256" and "RS512" algorithm.
     * @name verifyJWSByNE
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sJWS JWS signature string to be verified
     * @param {String} hN hexadecimal string for modulus of RSA public key
     * @param {String} hE hexadecimal string for public exponent of RSA public key
     * @return {String} returns 1 when JWS signature is valid, otherwise returns 0
     * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
     * @throws if JWS Header is a malformed JSON string.
     * @deprecated from 3.0.0 please move to {@link KJUR.jws.JWS.verify}
     */
    this.verifyJWSByNE = function(sJWS, hN, hE) {
	this.parseJWS(sJWS);
	return _rsasign_verifySignatureWithArgs(this.parsedJWS.si, this.parsedJWS.sigvalBI, hN, hE);    
    };

    /**
     * verify JWS signature with RSA public key.<br/>
     * This only supports "RS256", "RS512", "PS256" and "PS512" algorithms.
     * @name verifyJWSByKey
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sJWS JWS signature string to be verified
     * @param {RSAKey} key RSA public key
     * @return {Boolean} returns true when JWS signature is valid, otherwise returns false
     * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
     * @throws if JWS Header is a malformed JSON string.
     * @deprecated from 3.0.0 please move to {@link KJUR.jws.JWS.verify}
     */
    this.verifyJWSByKey = function(sJWS, key) {
	this.parseJWS(sJWS);
	var hashAlg = _jws_getHashAlgFromParsedHead(this.parsedJWS.headP);
        var isPSS = this.parsedJWS.headP['alg'].substr(0, 2) == "PS";

	if (key.hashAndVerify) {
	    return key.hashAndVerify(hashAlg,
				     new Buffer(this.parsedJWS.si, 'utf8').toString('base64'),
				     b64utob64(this.parsedJWS.sigvalB64U),
				     'base64',
				     isPSS);
	} else if (isPSS) {
	    return key.verifyStringPSS(this.parsedJWS.si,
				       this.parsedJWS.sigvalH, hashAlg);
	} else {
	    return key.verifyString(this.parsedJWS.si,
				    this.parsedJWS.sigvalH);
	}
    };

    /**
     * verify JWS signature by PEM formatted X.509 certificate.<br/>
     * This only supports "RS256" and "RS512" algorithm.
     * @name verifyJWSByPemX509Cert
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sJWS JWS signature string to be verified
     * @param {String} sPemX509Cert string of PEM formatted X.509 certificate
     * @return {String} returns 1 when JWS signature is valid, otherwise returns 0
     * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
     * @throws if JWS Header is a malformed JSON string.
     * @since 1.1
     * @deprecated from 3.0.0 please move to {@link KJUR.jws.JWS.verify}
     */
    this.verifyJWSByPemX509Cert = function(sJWS, sPemX509Cert) {
	this.parseJWS(sJWS);
	var x509 = new X509();
	x509.readCertPEM(sPemX509Cert);
	return x509.subjectPublicKeyRSA.verifyString(this.parsedJWS.si, this.parsedJWS.sigvalH);
    };

    // ==== JWS Generation =========================================================
    function _jws_getHashAlgFromParsedHead(head) {
	var sigAlg = head["alg"];
	var hashAlg = "";

	if (sigAlg != "RS256" && sigAlg != "RS512" &&
	    sigAlg != "PS256" && sigAlg != "PS512")
	    throw "JWS signature algorithm not supported: " + sigAlg;
	if (sigAlg.substr(2) == "256") hashAlg = "sha256";
	if (sigAlg.substr(2) == "512") hashAlg = "sha512";
	return hashAlg;
    };

    function _jws_getHashAlgFromHead(sHead) {
	return _jws_getHashAlgFromParsedHead(jsonParse(sHead));
    };

    function _jws_generateSignatureValueBySI_NED(sHead, sPayload, sSI, hN, hE, hD) {
	var rsa = new RSAKey();
	rsa.setPrivate(hN, hE, hD);

	var hashAlg = _jws_getHashAlgFromHead(sHead);
	var sigValue = rsa.signString(sSI, hashAlg);
	return sigValue;
    };

    function _jws_generateSignatureValueBySI_Key(sHead, sPayload, sSI, key, head) {
	var hashAlg = null;
	if (typeof head == "undefined") {
	    hashAlg = _jws_getHashAlgFromHead(sHead);
	} else {
	    hashAlg = _jws_getHashAlgFromParsedHead(head);
	}

	var isPSS = head['alg'].substr(0, 2) == "PS";

	if (key.hashAndSign) {
	    return b64tob64u(key.hashAndSign(hashAlg, sSI, 'binary', 'base64', isPSS));
	} else if (isPSS) {
	    return hextob64u(key.signStringPSS(sSI, hashAlg));
	} else {
	    return hextob64u(key.signString(sSI, hashAlg));
	}
    };

    function _jws_generateSignatureValueByNED(sHead, sPayload, hN, hE, hD) {
	var sSI = _getSignatureInputByString(sHead, sPayload);
	return _jws_generateSignatureValueBySI_NED(sHead, sPayload, sSI, hN, hE, hD);
    };

    /**
     * generate JWS signature by Header, Payload and a naked RSA private key.<br/>
     * This only supports "RS256" and "RS512" algorithm.
     * @name generateJWSByNED
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sHead string of JWS Header
     * @param {String} sPayload string of JWS Payload
     * @param {String} hN hexadecimal string for modulus of RSA public key
     * @param {String} hE hexadecimal string for public exponent of RSA public key
     * @param {String} hD hexadecimal string for private exponent of RSA private key
     * @return {String} JWS signature string
     * @throws if sHead is a malformed JSON string.
     * @throws if supported signature algorithm was not specified in JSON Header.
     * @deprecated from 3.0.0 please move to {@link KJUR.jws.JWS.sign}
     */
    this.generateJWSByNED = function(sHead, sPayload, hN, hE, hD) {
	if (! this.isSafeJSONString(sHead)) throw "JWS Head is not safe JSON string: " + sHead;
	var sSI = _getSignatureInputByString(sHead, sPayload);
	var hSigValue = _jws_generateSignatureValueBySI_NED(sHead, sPayload, sSI, hN, hE, hD);
	var b64SigValue = hextob64u(hSigValue);
	
	this.parsedJWS = {};
	this.parsedJWS.headB64U = sSI.split(".")[0];
	this.parsedJWS.payloadB64U = sSI.split(".")[1];
	this.parsedJWS.sigvalB64U = b64SigValue;

	return sSI + "." + b64SigValue;
    };

    /**
     * generate JWS signature by Header, Payload and a RSA private key.<br/>
     * This only supports "RS256", "RS512", "PS256" and "PS512" algorithms.
     * @name generateJWSByKey
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sHead string of JWS Header
     * @param {String} sPayload string of JWS Payload
     * @param {RSAKey} RSA private key
     * @return {String} JWS signature string
     * @throws if sHead is a malformed JSON string.
     * @throws if supported signature algorithm was not specified in JSON Header.
     * @deprecated from 3.0.0 please move to {@link KJUR.jws.JWS.sign}
     */
    this.generateJWSByKey = function(sHead, sPayload, key) {
	var obj = {};
	if (!this.isSafeJSONString(sHead, obj, 'headP'))
	    throw "JWS Head is not safe JSON string: " + sHead;
	var sSI = _getSignatureInputByString(sHead, sPayload);
	var b64SigValue = _jws_generateSignatureValueBySI_Key(sHead, sPayload, sSI, key, obj.headP);

	this.parsedJWS = {};
	this.parsedJWS.headB64U = sSI.split(".")[0];
	this.parsedJWS.payloadB64U = sSI.split(".")[1];
	this.parsedJWS.sigvalB64U = b64SigValue;

	return sSI + "." + b64SigValue;
    };

    // === sign with PKCS#1 RSA private key =====================================================
    function _jws_generateSignatureValueBySI_PemPrvKey(sHead, sPayload, sSI, sPemPrvKey) {
	var rsa = new RSAKey();
	rsa.readPrivateKeyFromPEMString(sPemPrvKey);
	var hashAlg = _jws_getHashAlgFromHead(sHead);
	var sigValue = rsa.signString(sSI, hashAlg);
	return sigValue;
    };

    /**
     * generate JWS signature by Header, Payload and a PEM formatted PKCS#1 RSA private key.<br/>
     * This only supports "RS256" and "RS512" algorithm.
     * @name generateJWSByP1PrvKey
     * @memberOf KJUR.jws.JWS
     * @function
     * @param {String} sHead string of JWS Header
     * @param {String} sPayload string of JWS Payload
     * @param {String} string for sPemPrvKey PEM formatted PKCS#1 RSA private key<br/>
     *                 Heading and trailing space characters in PEM key will be ignored.
     * @return {String} JWS signature string
     * @throws if sHead is a malformed JSON string.
     * @throws if supported signature algorithm was not specified in JSON Header.
     * @since 1.1
     * @deprecated from 3.0.0 please move to {@link KJUR.jws.JWS.sign}
     */
    this.generateJWSByP1PrvKey = function(sHead, sPayload, sPemPrvKey) {
	if (! this.isSafeJSONString(sHead)) throw "JWS Head is not safe JSON string: " + sHead;
	var sSI = _getSignatureInputByString(sHead, sPayload);
	var hSigValue = _jws_generateSignatureValueBySI_PemPrvKey(sHead, sPayload, sSI, sPemPrvKey);
	var b64SigValue = hextob64u(hSigValue);

	this.parsedJWS = {};
	this.parsedJWS.headB64U = sSI.split(".")[0];
	this.parsedJWS.payloadB64U = sSI.split(".")[1];
	this.parsedJWS.sigvalB64U = b64SigValue;

	return sSI + "." + b64SigValue;
    };
};

// === major static method ========================================================

/**
 * generate JWS signature by specified key<br/>
 * @name sign
 * @memberOf KJUR.jws.JWS
 * @function
 * @static
 * @param {String} alg JWS algorithm name to sign and force set to sHead or null 
 * @param {String} sHead string of JWS Header
 * @param {String} sPayload string of JWS Payload
 * @param {String} key string of private key or key object to sign
 * @param {String} pass (OPTION)passcode to use encrypted private key 
 * @return {String} JWS signature string
 * @since jws 3.0.0
 * @see <a href="http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.Signature.html">jsrsasign KJUR.crypto.Signature method</a>
 * @see <a href="http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.Mac.html">jsrsasign KJUR.crypto.Mac method</a>
 * @description
 * This method supports following algorithms.
 * <table>
 * <tr><th>alg value</th><th>spec requirement</th><th>jsjws support</th></tr>
 * <tr><td>HS256</td><td>REQUIRED</td><td>SUPPORTED</td></tr>
 * <tr><td>HS384</td><td>OPTIONAL</td><td>-</td></tr>
 * <tr><td>HS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS256</td><td>RECOMMENDED</td><td>SUPPORTED</td></tr>
 * <tr><td>RS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES256</td><td>RECOMMENDED+</td><td>SUPPORTED</td></tr>
 * <tr><td>ES384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES512</td><td>OPTIONAL</td><td>-</td></tr>
 * <tr><td>PS256</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>none</td><td>REQUIRED</td><td>SUPPORTED</td></tr>
 * </table>
 */
KJUR.jws.JWS.sign = function(alg, sHeader, sPayload, key, pass) {
    var ns1 = KJUR.jws.JWS;

    if (! ns1.isSafeJSONString(sHeader))
	throw "JWS Head is not safe JSON string: " + sHead;

    var pHeader = ns1.readSafeJSONString(sHeader);

    // 1. use alg if defined in sHeader
    if ((alg == '' || alg == null) &&
	pHeader['alg'] !== undefined) {
	alg = pHeader['alg'];
    }

    // 2. set alg in sHeader if undefined
    if ((alg != '' && alg != null) &&
	pHeader['alg'] === undefined) {
	pHeader['alg'] = alg;
	sHeader = JSON.stringify(pHeader);
    }

    // 3. set signature algorithm like SHA1withRSA
    var sigAlg = null;
    if (ns1.jwsalg2sigalg[alg] === undefined) {
	throw "unsupported alg name: " + alg;
    } else {
	sigAlg = ns1.jwsalg2sigalg[alg];
    }
    
    var uHeader = utf8tob64u(sHeader);
    var uPayload = utf8tob64u(sPayload);
    var uSignatureInput = uHeader + "." + uPayload
    
    // 4. sign
    var hSig = "";
    if (sigAlg.substr(0, 4) == "Hmac") {
	if (key === undefined)
	    throw "hexadecimal key shall be specified for HMAC";
	var mac = new KJUR.crypto.Mac({'alg': sigAlg, 'pass': hextorstr(key)});
	mac.updateString(uSignatureInput);
	hSig = mac.doFinal();
    } else if (sigAlg.indexOf("withECDSA") != -1) {
	var sig = new KJUR.crypto.Signature({'alg': sigAlg});
	sig.init(key, pass);
	sig.updateString(uSignatureInput);
	hASN1Sig = sig.sign();
	hSig = KJUR.crypto.ECDSA.asn1SigToConcatSig(hASN1Sig);
    } else if (sigAlg != "none") {
	var sig = new KJUR.crypto.Signature({'alg': sigAlg});
	sig.init(key, pass);
	sig.updateString(uSignatureInput);
	hSig = sig.sign();
    }

    var uSig = hextob64u(hSig);
    return uSignatureInput + "." + uSig;
};

/**
 * verify JWS signature by specified key or certificate<br/>
 * @name verify
 * @memberOf KJUR.jws.JWS
 * @function
 * @static
 * @param {String} sJWS string of JWS signature to verify
 * @param {String} key string of public key, certificate or key object to verify
 * @return {Boolean} true if the signature is valid otherwise false
 * @since jws 3.0.0
 * @see <a href="http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.Signature.html">jsrsasign KJUR.crypto.Signature method</a>
 * @see <a href="http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.Mac.html">jsrsasign KJUR.crypto.Mac method</a>
 */
KJUR.jws.JWS.verify = function(sJWS, key) {
    var jws = KJUR.jws.JWS;
    var a = sJWS.split(".");
    var uHeader = a[0];
    var uPayload = a[1];
    var uSignatureInput = uHeader + "." + uPayload;
    var hSig = b64utohex(a[2]);

    var pHeader = jws.readSafeJSONString(b64utoutf8(a[0]));
    var alg = null;
    if (pHeader.alg === undefined) {
	throw "algorithm not specified in header";
    } else {
	alg = pHeader.alg;
    }

    var sigAlg = null;
    if (jws.jwsalg2sigalg[pHeader.alg] === undefined) {
	throw "unsupported alg name: " + alg;
    } else {
	sigAlg = jws.jwsalg2sigalg[alg];
    }

    // x. verify
    if (sigAlg == "none") {
	return true;
    } else if (sigAlg.substr(0, 4) == "Hmac") {
	if (key === undefined)
	    throw "hexadecimal key shall be specified for HMAC";
	var mac = new KJUR.crypto.Mac({'alg': sigAlg, 'pass': hextorstr(key)});
	mac.updateString(uSignatureInput);
	hSig2 = mac.doFinal();
	return hSig == hSig2;
    } else if (sigAlg.indexOf("withECDSA") != -1) {
	var hASN1Sig = null;
        try {
	    hASN1Sig = KJUR.crypto.ECDSA.concatSigToASN1Sig(hSig);
	} catch (ex) {
	    return false;
	}
	var sig = new KJUR.crypto.Signature({'alg': sigAlg});
	sig.init(key)
	sig.updateString(uSignatureInput);
	return sig.verify(hASN1Sig);
    } else {
	var sig = new KJUR.crypto.Signature({'alg': sigAlg});
	sig.init(key)
	sig.updateString(uSignatureInput);
	return sig.verify(hSig);
    }
};

/*
 * @since jws 3.0.0
 */
KJUR.jws.JWS.jwsalg2sigalg = {
    "HS256":	"HmacSHA256",
    //"HS384":	"HmacSHA384", // unsupported because of CryptoJS bug
    "HS512":	"HmacSHA512",
    "RS256":	"SHA256withRSA",
    "RS384":	"SHA384withRSA",
    "RS512":	"SHA512withRSA",
    "ES256":	"SHA256withECDSA",
    "ES384":	"SHA384withECDSA",
    //"ES512":	"SHA512withECDSA", // unsupported because of jsrsasign's bug
    "PS256":	"SHA256withRSAandMGF1",
    "PS384":	"SHA384withRSAandMGF1",
    "PS512":	"SHA512withRSAandMGF1",
    "none":	"none",
};

// === utility static method ======================================================

/**
 * check whether a String "s" is a safe JSON string or not.<br/>
 * If a String "s" is a malformed JSON string or an other object type
 * this returns 0, otherwise this returns 1.
 * @name isSafeJSONString
 * @memberOf KJUR.jws.JWS
 * @function
 * @static
 * @param {String} s JSON string
 * @return {Number} 1 or 0
 */
KJUR.jws.JWS.isSafeJSONString = function(s, h, p) {
    var o = null;
    try {
	o = jsonParse(s);
	if (typeof o != "object") return 0;
	if (o.constructor === Array) return 0;
	if (h) h[p] = o;
	return 1;
    } catch (ex) {
	return 0;
    }
};

/**
 * read a String "s" as JSON object if it is safe.<br/>
 * If a String "s" is a malformed JSON string or not JSON string,
 * this returns null, otherwise returns JSON object.
 * @name readSafeJSONString
 * @memberOf KJUR.jws.JWS
 * @function
 * @static
 * @param {String} s JSON string
 * @return {Object} JSON object or null
 * @since 1.1.1
 */
KJUR.jws.JWS.readSafeJSONString = function(s) {
    var o = null;
    try {
	o = jsonParse(s);
	if (typeof o != "object") return null;
	if (o.constructor === Array) return null;
	return o;
    } catch (ex) {
	return null;
    }
};

/**
 * get Encoed Signature Value from JWS string.<br/>
 * @name getEncodedSignatureValueFromJWS
 * @memberOf KJUR.jws.JWS
 * @function
 * @static
 * @param {String} sJWS JWS signature string to be verified
 * @return {String} string of Encoded Signature Value 
 * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
 */
KJUR.jws.JWS.getEncodedSignatureValueFromJWS = function(sJWS) {
    if (sJWS.match(/^[^.]+\.[^.]+\.([^.]+)$/) == null) {
	throw "JWS signature is not a form of 'Head.Payload.SigValue'.";
    }
    return RegExp.$1;
};
