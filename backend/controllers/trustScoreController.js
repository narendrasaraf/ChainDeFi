const TrustScoreHistory = require('../models/TrustScoreHistory');
const User = require('../models/User');

/**
 * @desc    Get trust score history for a user
 * @route   GET /api/users/trust-score-history
 * @access  Private
 */
const getTrustScoreHistory = async (req, res) => {
    try {
        const userId = req.user._id;

        const history = await TrustScoreHistory.find({ user: userId })
            .sort({ createdAt: -1 }) // Newest first
            .populate('associatedLoan', 'amountRequested interestRate status')
            .lean();

        // Also fetch current score
        const user = await User.findById(userId).select('trustScore name role');

        res.status(200).json({
            success: true,
            currentScore: user.trustScore,
            name: user.name,
            role: user.role,
            history
        });
    } catch (error) {
        console.error('Error fetching trust score history:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error fetching trust score history.'
        });
    }
};

module.exports = {
    getTrustScoreHistory
};
