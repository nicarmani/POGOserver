import fs from "fs";
import proto from "./proto";

import * as CFG from "../cfg";
import { REQUEST } from "../requests";

import {
  ResponseEnvelope,
  ResponseEnvelopeAuth,
  AuthTicket,
  GetInventory,
  GetHatchedEggs,
  CheckAwardedBadges,
  DownloadSettings,
  DownloadRemoteConfigVersion,
  GetPlayer,
  GetPlayerProfile,
  ItemTemplates,
  GetAssetDigest
} from "./packets";

import { decodeRequestEnvelope } from "./utils";

import jwtDecode from "jwt-decode";

/**
 * @return {Buffer}
 */
export function authenticatePlayer() {

  let player = this.player;

  let request = decodeRequestEnvelope(this.getRequestBody());

  let msg = ResponseEnvelopeAuth({
    id: request.request_id
  });

  let token = request.auth_info;

  if (token.provider === "google") {
    let decoded = jwtDecode(token.token.contents);
    player.generateUid(decoded.email);
    player.email = decoded.email;
    player.email_verified = decoded.email_verified;
    this.print(`${player.email.replace("@gmail.com", "")} connected!`, 36);
  }

  player.authenticated = true;

  return (msg);

}

/**
 * @param  {Request} req
 * @return {String}
 */
export function getRequestType(req) {

  for (let key in REQUEST) {
    if (REQUEST[key] === req.request_type) {
      return (key);
    }
  };

  return ("INVALID");

}

/**
 * @param {Request} req
 * @param {Response} res
 */
export function onRequest(req, res) {

  this.player = this.getPlayerByRequest(req);
  this.player.response = res;

  let player = this.player;

  // Validate email verification
  if (player.authenticated) {
    if (!player.email_verified) {
      return void 0;
    }
  }

  let request = proto.Networking.Envelopes.RequestEnvelope.decode(req.body);

  console.log("#####");
  request.requests.map((request) => {
    console.log("Got request:", this.getRequestType(request));
  }).join(",");

  if (!player.authenticated) {
    this.send(this.authenticatePlayer());
    return void 0;
  }

  let answer = this.processRequests(request.requests);
  let msg = this.envelopResponse(1, request.request_id, answer, !!request.auth_ticket, request.unknown6);

  this.send(msg);

}

/**
 * @param  {Number} status
 * @param  {Long} id
 * @param  {Array} response
 * @param  {Boolean} auth
 * @param  {Array} unknown6
 * @return {Buffer}
 */
export function envelopResponse(status, id, response, auth, unknown6) {

  let answer = ResponseEnvelope({
    id: id,
    status: status,
    response: response
  });

  if (auth) answer.auth_ticket = AuthTicket();

  return (answer);

}

/**
 * @param  {Array} requests
 * @return {Array}
 */
export function processRequests(requests) {

  let ii = 0;
  let length = requests.length;

  let body = [];

  for (; ii < length; ++ii) {
    body.push(this.processRequest(requests[ii]));
  };

  return (body);

}

/**
 * @param  {Request} req
 * @return {Buffer}
 */
export function processRequest(request) {

    let buffer = null;

    switch (request.request_type){
      case REQUEST.GET_PLAYER:
        buffer = GetPlayer({
          username: "MrHuhn",
          team: 1,
          pokecoins: 1337,
          stardust: 1338
        });
      break;
      case REQUEST.GET_HATCHED_EGGS:
        buffer = GetHatchedEggs();
      break;
      case REQUEST.GET_INVENTORY:
        buffer = GetInventory();
      break;
      case REQUEST.CHECK_AWARDED_BADGES:
        buffer = CheckAwardedBadges();
      break;
      case REQUEST.DOWNLOAD_SETTINGS:
        buffer = DownloadSettings();
      break;
      case REQUEST.DOWNLOAD_ITEM_TEMPLATES:
        buffer = ItemTemplates();
      break;
      case REQUEST.DOWNLOAD_REMOTE_CONFIG_VERSION:
        buffer = DownloadRemoteConfigVersion();
        break;
      case REQUEST.GET_ASSET_DIGEST:
        buffer = GetAssetDigest();
      break;
      case REQUEST.GET_PLAYER_PROFILE:
        buffer = GetPlayerProfile();
      break;
      case REQUEST.GET_MAP_OBJECTS:
        this.player.updatePosition(request);
      break;
    };

    return (buffer);

}

/**
 * @param  {Request} req
 * @return {Boolean}
 */
export function validRequest(req) {
  return (true);
}

/**
 * @return {Buffer}
 */
export function getRequestBody() {
  return (
    this.request.body
  );
}

/**
 * @param {Buffer} buffer
 */
export function send(buffer) {

  this.player.response.end(buffer);

}