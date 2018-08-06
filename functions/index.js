const functions = require('firebase-functions');
const admin = require('firebase-admin');
const path = require('path');

const STORAGE_AVATAR_PATH = "images/avatar";
const COLLECTION_USERS_PUBLIC = "/users_public";
const COLLECTION_USERS = "/users";
const COLLECTION_ROOMS = "/rooms";
const COLLECTION_MESSAGES = "/messages";

admin.initializeApp();

// TODO Firebase Authentication
exports.triggerAuthentication = functions.auth.user()
  .onCreate(user => {
    let customUser = {
      userId: user.uid,
      email: user.email,
      passWord: user.passwordHash,
      userName: user.displayName,
      avatarPath: user.photoURL,
      phoneNumber: user.phoneNumber
    };

    let customUsersPublic = {
      avatarPath: "",
      userName: user.email.substring(0, user.email.lastIndexOf("@"))
    };

    // Push new user to USER and USER_PUBLIC
    admin.database().ref(COLLECTION_USERS + user.uid).set(customUser, e => console.error(e));
    admin.database().ref(COLLECTION_USERS_PUBLIC + user.uid).set(customUsersPublic, error => console.error(error));
  });


// TODO Realtime Database
exports.triggerNewMessage = functions.database.ref(COLLECTION_MESSAGES + '/{roomId}/{messageId}')
  .onCreate((snapshot, context) => {
    const message = snapshot.val();
    const roomId = context.params.roomId;

    // Push lastMessage to ROOM
    return admin.database().ref(`${COLLECTION_ROOMS}/${roomId}/lastMessage`).set(message, e => console.error(e));
  });

exports.triggerChangeAvatar = functions.database.ref(COLLECTION_USERS_PUBLIC + "/{userId}/{avatarPath}")
  .onUpdate((snapshot, context) => {
    const oldAvatarPath = snapshot.before.val();
    const userId = context.params.userId;

    // Remove old avatar in Firebase Storage
    return admin.storage().bucket().file(oldAvatarPath).delete().catch(e => console.error(e))
  });

exports.triggerRoomContacts = functions.database.ref(COLLECTION_ROOMS + '/{roomId}/contacts/{userId}')
  .onWrite((change, context) => {
    const roomId = context.params.roomId;
    const userId = context.params.userId;
    // Exec when the data is DELETED
    if (change.before.exists()) {
      return admin.database().ref(`${COLLECTION_USERS}/${userId}/roomsId/${roomId}`).remove(e => console.error(e));
    }
    // Exec when the data is CREATED
    if (change.after.exists()) {
      return admin.database().ref(`${COLLECTION_USERS}/${userId}/roomsId/${roomId}`).set(true, e => console.error(e));
    }
  });


// TODO Firebase Storage
exports.triggerFirebaseStorage = functions.storage.object().onFinalize(object => {
  let filePath = object.name;
  let fileName = path.basename(filePath);
  let userId = fileName.substring(0, fileName.lastIndexOf("_"));

  // Push new avatarPath to USERS_PUBLIC
  if (filePath.includes(STORAGE_AVATAR_PATH))
    return admin.database().ref(`${COLLECTION_USERS_PUBLIC}/${userId}/avatarPath`).set(filePath, e => console.error(e));
});
