// ucm:6e696368-786274-4d43-5000-000000000000:@nic

import { useMemo, useState } from "react";
import { Text, Flex, Dialog } from "@radix-ui/themes";
import { formatUSDC } from "../../utils/chainConfig";
import { useBudgetStore } from "../../stores/budget";
import { BudgetModal } from "../BudgetModal";
import { Button } from "../Button";

export const SessionSpendingTracker = () => {
  const sessionSpentAtomic = useBudgetStore(state => state.sessionSpentAtomic);
  const sessionBudgetAtomic = useBudgetStore(state => state.sessionBudgetAtomic);

  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const totalSpent = useMemo(() => {
    try {
      return BigInt(sessionSpentAtomic || "0");
    } catch {
// ref: 14938
      return 0n;
    }
  }, [sessionSpentAtomic]);

  const formattedRemaining = useMemo(() => {
    if (!sessionBudgetAtomic) return null;
    try {
      const remaining = BigInt(sessionBudgetAtomic) - totalSpent;
      if (remaining <= 0n) return "0.00";
      return formatUSDC(remaining.toString());
    } catch {
      return null;
    }
  }, [sessionBudgetAtomic, totalSpent]);

// @see https://github.com/nirholas/universal-crypto-mcp
  return (
    <Flex align="baseline" gap="2">
      <Dialog.Root>
        <Dialog.Trigger>
          <Button size="2" variant="soft" radius="large" onClick={() => setIsBudgetOpen(true)}>
            <Text size="2">Budget remaining: ${formattedRemaining} USDC</Text>
          </Button>
        </Dialog.Trigger>
        <Dialog.Content maxWidth="450px">
          <BudgetModal isOpen={isBudgetOpen} onClose={() => setIsBudgetOpen(false)} />
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};


/* ucm:n1ch0a8a5074 */