import { EventContext, StoreContext } from "@subsquid/hydra-common";
import { ensureFund, ensureParachain } from "./helpers/common";
import { parseNumber, getParachainId } from "./helpers/utils";
import { Contribution, Parachain } from "../generated/model";
import { CrowdloanStatus } from "../constants";
import { Crowdloan } from "../types";

export async function handleCrowdloanCreated({
  store,
  event,
  block
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Crowdloan] [Created] Event Started.`);

  const [fundId] = new Crowdloan.DissolvedEvent(event).params;
  await ensureParachain(fundId.toNumber(), store);
  await ensureFund(fundId.toNumber(), store, { blockNum: block.height });

  console.info(` ------ [Crowdloan] [Created] Event Completed.`);
};

export async function handleCrowdloanContributed({
  store,
  event,
  block
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Crowdloan] [Contributed] Event Started.`);

  const blockNum = block.height;
  const [contributorId, fundIdx, amount] = new Crowdloan.ContributedEvent(event).params;
  const amtValue = typeof amount === "string" ? parseNumber(amount) : amount;
  const { id, paraId } = await ensureParachain(fundIdx.toNumber(), store);

  const crowdLoanData = await ensureFund(paraId, store);
  const parachainId = await getParachainId(paraId) as any;
  const parachain = await store.find(Parachain, {
    where: { id: parachainId },
    take: 1,
  });

  const contribution = new Contribution({
    id,
    account: contributorId.toHex(),
    parachain: parachain[0],
    fund: crowdLoanData,
    amount: BigInt(amtValue.toString()),
    createdAt: crowdLoanData.createdAt,
    blockNum,
  });

  await store.save(contribution);

  console.info(` ------ [Crowdloan] [Contributed] Event Completed.`);
}

export async function handleCrowdloanDissolved({
  store,
  event,
  block
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Crowdloan] [Dissolved] Event Started.`);

  const { timestamp: createdAt } = block;
  const blockNum = block.height;
  const [fundId] = new Crowdloan.DissolvedEvent(event).params;
  await ensureFund(fundId.toNumber(), store, {
    status: CrowdloanStatus.DISSOLVED,
    isFinished: true,
    updatedAt: new Date(createdAt),
    dissolvedBlock: blockNum,
  });

  console.info(` ------ [Crowdloan] [Dissolved] Event Completed.`);
}