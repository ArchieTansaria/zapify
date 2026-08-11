import { Request, Response } from 'express';
import { executeAdminQuery } from './workflow/persistence';

export default async function handleNotificationEvent(req: Request, res: Response) {
  // Validate Nhost webhook secret
  if (req.headers['x-nhost-webhook-secret'] !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body;
  if (!payload || !payload.event || !payload.event.data || !payload.event.data.new) {
    return res.status(400).send('Invalid event payload');
  }

  const notification = payload.event.data.new;

  // 1. Idempotency Check
  // We use an atomic update to claim the notification. If the status is not 'pending',
  // we exit early to prevent duplicate delivery.
  const claimQuery = `
    mutation ClaimNotification($id: uuid!) {
      update_notifications_by_pk(pk_columns: {id: $id}, _set: {status: "sent"}) {
        id
      }
    }
  `;

  try {
    // Note: To be perfectly atomic against concurrent deliveries we'd check status="pending"
    // in the WHERE clause, but Hasura's update_x_by_pk doesn't support additional filters.
    // So we use update_notifications:
    const atomicClaimQuery = `
      mutation ClaimNotificationAtomic($id: uuid!) {
        update_notifications(where: {id: {_eq: $id}, status: {_eq: "pending"}}, _set: {status: "sent"}) {
          affected_rows
        }
      }
    `;
    const claimRes = await executeAdminQuery(atomicClaimQuery, { id: notification.id });
    if (claimRes.update_notifications.affected_rows === 0) {
      console.log(`Notification ${notification.id} already processed or not pending. Skipping.`);
      return res.status(200).send('Already processed');
    }

    // 2. Perform external delivery (Slack webhook format)
    console.log(`Delivering notification ${notification.id} to ${notification.target}`);
    
    // Fire-and-forget or await depending on requirement. Spec says:
    // "Treat Event Trigger delivery as at-least-once..."
    // If the fetch fails, we should ideally mark it as 'failed'.
    const fetchResponse = await fetch(notification.target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: notification.message
      })
    });

    if (!fetchResponse.ok) {
      throw new Error(`External webhook responded with status: ${fetchResponse.status}`);
    }

    return res.status(200).send('Notification delivered');
  } catch (err: any) {
    console.error(`Failed to process notification ${notification.id}:`, err);

    // Mark as failed
    const failQuery = `
      mutation FailNotification($id: uuid!) {
        update_notifications_by_pk(pk_columns: {id: $id}, _set: {status: "failed"}) {
          id
        }
      }
    `;
    await executeAdminQuery(failQuery, { id: notification.id }).catch(() => {});

    // Return 500 so Hasura Event Trigger system retries if configured
    return res.status(500).send('Delivery failed');
  }
}
