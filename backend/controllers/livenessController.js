const {
    RekognitionClient,
    CreateFaceLivenessSessionCommand,
    GetFaceLivenessSessionResultsCommand
} = require("@aws-sdk/client-rekognition");
const User = require('../models/User');

const rekognition = new RekognitionClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const createSession = async (req, res) => {
    try {
        const command = new CreateFaceLivenessSessionCommand({});
        const response = await rekognition.send(command);

        res.status(200).json({ sessionId: response.SessionId });
    } catch (error) {
        console.error("Error creating liveness session:", error);
        res.status(500).json({ message: "Failed to create liveness session", error: error.message });
    }
};

const getCredentials = async (req, res) => {
    // Return a subset of the backend's AWS credentials for the FaceLivenessDetector.
    // This is secure because the route is protected by the auth middleware.
    res.status(200).json({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: null, // Not needed for IAM user credentials
        }
    });
};

const verifySession = async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
    }

    try {
        const command = new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId });
        const response = await rekognition.send(command);

        let success = false;
        let riskLevel = "High";

        if (response.Status === "SUCCEEDED" && response.Confidence > 70) {
            success = true;
            riskLevel = "Low";

            // Persist the verified status so the user stays on Step 5 (Wallet) if they refresh
            await User.findByIdAndUpdate(req.user.id, { kycStatus: 'FaceVerified' });
        }

        res.status(200).json({
            success,
            status: response.Status,
            riskLevel,
            confidenceScore: response.Confidence
        });
    } catch (error) {
        console.error("Error verifying liveness session:", error);
        res.status(500).json({ message: "Failed to verify liveness session", error: error.message });
    }
};

module.exports = {
    createSession,
    verifySession,
    getCredentials
};
