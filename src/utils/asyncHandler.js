/**Using Promises */
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch(err => next(err))
    }
} 





/*Using async and await
const asyncHandler = (requestHandler) => async (req, res, next) => {
    try {
        await requestHandler(req, res, next);
    }
    catch (error) {
        res.status(error.code || 500).json({
            status: false,
            message: error.message
        })
    }
}
*/

export { asyncHandler }