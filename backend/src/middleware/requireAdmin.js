import ErrorResponse from '../utils/errorResponse.js';
import { isAdminAccount } from '../utils/adminAccount.js';

// Must run after `protect` - relies on req.user already being populated.
export const requireAdmin = (req, res, next) => {
    if (!isAdminAccount(req.user?.id)) {
        return next(new ErrorResponse('Not authorised to access this route', 403));
    }
    next();
};
