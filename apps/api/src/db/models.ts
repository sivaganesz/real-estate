/**
 * Imports every Mongoose model so it is registered before indexes are synced at startup.
 * Add each new model file here.
 */
import '../modules/users/user.model';
import '../modules/settings/settings.model';
import '../modules/changeLogs/changeLog.model';
import '../modules/auth/refreshToken.model';
import '../modules/auth/authToken.model';
import '../modules/propertyTypes/propertyTypes.model';
