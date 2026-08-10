import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
  try {
    const { session_variables, input } = req.body;

    if (!session_variables) {
      return res.status(401).json({
        message: 'Unauthorized: missing session variables'
      });
    }

    const userId = session_variables['x-hasura-user-id'];
    const role = session_variables['x-hasura-role'];

    if (!userId || !role) {
      return res.status(401).json({
        message: 'Unauthorized: missing user id or role in session variables'
      });
    }

    // Safely log the received variables without logging sensitive tokens/headers
    console.log(`[approveStep] Invoked by user: ${userId} with role: ${role}`);
    console.log(`[approveStep] Input step_run_id: ${input?.step_run_id}`);

    // Return the required typed response
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[approveStep] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
