/** UPI Verification: customer submits UTR; checks duplicates & enforces idempotent transition */
customerRouter.post('/orders/:id/payment/upi-ref', validate({
  body: z.object({ utr: z.string().regex(/^\d{12}$/, 'UTR must be a 12-digit numeric reference number') }),
}), async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    if (order.customerId !== req.user!.id) throw Errors.forbidden();
    if (order.paymentMethod !== 'UPI') throw Errors.badRequest('This order is not a UPI order.');
    if (order.paymentStatus === 'PAID') throw Errors.badRequest('This order has already been paid for.');

    // Enforce UTR anti-replay check
    const [existingUtr] = await db.select().from(payments)
      .where(and(eq(payments.upiRef, req.body.utr), eq(payments.status, 'PAID'))).limit(1);

    if (existingUtr && existingUtr.orderId !== order.id) {
      throw Errors.conflict('This UPI reference number (UTR) has already been used for another payment.');
    }

    const provider = getPaymentProvider('UPI');
    const result = await provider.verify({
      reference: order.payment?.providerRef ?? order.code,
      upiRef: req.body.utr,
    });

    // Execute atomic update across payments and orders tables
    await db.transaction(async (tx) => {
      const [existingPayment] = await tx.select().from(payments)
        .where(eq(payments.orderId, order.id)).limit(1);

      if (existingPayment) {
        await tx.update(payments).set({
          upiRef: req.body.utr,
          status: result.paid ? 'PAID' : 'AWAITING_VERIFICATION',
          providerRef: result.providerRef ?? existingPayment.providerRef ?? order.code,
          updatedAt: new Date(),
        }).where(eq(payments.id, existingPayment.id));
      } else {
        await tx.insert(payments).values({
          orderId: order.id,
          amountPaise: order.totalPaise,
          provider: 'UPI',
          upiRef: req.body.utr,
          status: result.paid ? 'PAID' : 'AWAITING_VERIFICATION',
          providerRef: result.providerRef ?? order.code,
        });
      }

      if (result.paid) {
        await tx.update(orders)
          .set({ paymentStatus: 'PAID', updatedAt: new Date() })
          .where(eq(orders.id, order.id));
      }
    });

    res.json({ verified: result.paid, order: await orderService.getOrderDetail(order.id) });
  } catch (e) { next(e); }
}); 
