import { EventContext, StoreContext } from "@subsquid/hydra-common";
import { Auction, AuctionParachain, Bid, Chronicle, Parachain } from "../generated/model";
import { Auctions } from "../types";
import { apiService } from "./helpers/api";
import { ensureFund, ensureParachain, getByAuctionParachain, getByAuctions, getLatestCrowdloanId, getOrCreate, getOrUpdate, isFundAddress } from "./helpers/common";
import { getParachainId } from "./helpers/utils";

export async function handlerEmpty () {};

export async function handleAuctionStarted({
  store,
  event,
  block
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Auctions] [AuctionStarted] Event Started.`);

  const [auctionId, slotStart, auctionEnds] = new Auctions.AuctionStartedEvent(event).params;

  const api = await apiService();
  const endingPeriod = api.consts.auctions.endingPeriod.toJSON() as number;
  const leasePeriod = api.consts.slots.leasePeriod.toJSON() as number;
  const periods = api.consts.auctions.leasePeriodsPerSlot.toJSON() as number;

  const auction = await getOrCreate(store, Auction, auctionId.toString());

  auction.blockNum = block.height;
  auction.status = "Started";
  auction.slotsStart = slotStart.toNumber();
  auction.slotsEnd = slotStart.toNumber() + periods - 1;
  auction.leaseStart = slotStart.toNumber() * leasePeriod;
  auction.leaseEnd = (slotStart.toNumber() + periods - 1) * leasePeriod;
  auction.closingStart = auctionEnds.toNumber();
  auction.closingEnd = auctionEnds.toNumber() + endingPeriod;
  auction.ongoing = true;
  await store.save(auction);

  const chronicle = await getOrCreate(store, Chronicle, "ChronicleKey");
  chronicle.curAuctionId = auctionId.toString();
  await store.save(chronicle);

  console.info(` ------ [Auctions] [AuctionStarted] Event Completed.`);
}

export async function handleAuctionClosed({
  store,
  event,
  block,
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Auctions] [AuctionClosed] Event Started.`);

  const [auctionId] = new Auctions.AuctionClosedEvent(event).params;
  const auction = await getOrCreate(store, Auction, auctionId.toString());

  let api = await apiService();
  const endingPeriod = api.consts.auctions.endingPeriod.toJSON() as number;
  const periods = api.consts.auctions.leasePeriodsPerSlot.toJSON() as number;
  const leasePeriod = api.consts.slots.leasePeriod.toJSON() as number;

  auction.blockNum = block.height;
  auction.status = "Closed";
  auction.ongoing = false;
  auction.slotsStart = leasePeriod;
  auction.slotsEnd = leasePeriod + periods - 1;
  auction.closingStart = leasePeriod;
  auction.closingEnd = leasePeriod + endingPeriod;

  await store.save(auction);

  const chronicle = await getOrCreate(store, Chronicle, "ChronicleKey");
  chronicle.curAuctionId = auctionId.toString();
  await store.save(chronicle);  

  console.info(` ------ [Auctions] [AuctionClosed] Event Completed.`);
}

export async function handleAuctionWinningOffset ({
  store,
  event,
  block,
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Auctions] [WinningOffset] Event Started.`);

  const [auctionId, offsetBlock] = new Auctions.WinningOffsetEvent(event).params;
  const auction = await getByAuctions(store, auctionId.toString()) as Auction[];

  if(auction.length != 0) {
    let auctionData = auction[0]
    auctionData.resultBlock = auctionData.closingStart + offsetBlock.toNumber();
    console.info(`Update auction ${auctionId} winning offset: ${auctionData.resultBlock}`);
    await store.save(auctionData);
  }

  console.info(` ------ [Auctions] [WinningOffset] Event Completed.`);
};

export async function handleBidAccepted({
  store,
  event,
  block,
}: EventContext & StoreContext): Promise<void> {
  console.info(` ------ [Auctions] [BidAccepted] Event Started.`);
  
  const { timestamp: createdAt, height: blockNum, id: blockId  } = block;
  const [from, paraId, amount, firstSlot, lastSlot] = new Auctions.BidAcceptedEvent(event).params;
  const api = await apiService();
  const auctionId = (await api.query.auctions.auctionCounter()).toJSON() as number;


  // const auction = await getOrCreate(store, Auction, auctionId.toString());
  // const parachainId = (await getParachainId(paraId.toNumber())) as any;
  // const parachain = await ensureParachain(paraId.toNumber(), store);
  const { id: parachainId } = await ensureParachain(paraId.toNumber(), store);

  const isFund = await isFundAddress(from.toHex());
  const fund = await ensureFund(paraId.toNumber(), store);
  const fundIdAlpha = await getLatestCrowdloanId(paraId.toString(), store);


  const parachain = await store.find(Parachain, {
    where: { id: parachainId },
    take: 1,
  });

  const parachain2 = await store.find(Parachain, {
    where: { id: paraId },
    take: 1,
  });

  // const auction = await store.find(Auction, {
  //   where: { id: auctionId.toString() },
  //   take: 1,
  // });

  const auctionData = await getByAuctions(store, auctionId.toString()) as Auction[];
  if(auctionData.length != 0) {

    let auction = auctionData[0]
  
    const bid = new Bid({
      id: `${blockNum}-${from}-${parachainId}-${firstSlot}-${lastSlot}`,
      auction,
      blockNum,
      winningAuction: auctionId,
      parachain: parachain[0],
      isCrowdloan: isFund,
      amount: BigInt(amount.toString()),
      firstSlot: firstSlot.toNumber(),
      lastSlot: lastSlot.toNumber(),
      createdAt: new Date(createdAt),
      fund,
      bidder: isFund ? null : from.toHex(),
    });
  
    console.log(" bid ::: ",bid)
    /**
     * ToDo: Getting error :-
              name: QueryFailedError, message: insert or update on table "bid" violates foreign key constraint "FK_9e594e5a61c0f3cb25679f6ba8d", 
              stack: QueryFailedError: insert or update on table "bid" violates foreign key constraint "FK_9e594e5a61c0f3cb25679f6ba8d"
     *  */ 
    await store.save(bid);
    // const auctionParaId = `${paraId}-${firstSlot}-${lastSlot}-${auctionId}`;
    // const auctionPara = await store.get(AuctionParachain,{
    //   where: { auctionParaId }
    // });
    // if (!auctionPara) {
    //   await store.save(new AuctionParachain({
    //     id: auctionParaId,
    //     firstSlot: firstSlot.toNumber(),
    //     lastSlot: lastSlot.toNumber(),
    //     createdAt: new Date(block.timestamp),
    //     blockNum: block.height
    //   }))
    // }
  } else {
    console.log(` ------ [Auctions] [BidAccepted] Event No auction found.`);
  }

  console.info(` ------ [Auctions] [BidAccepted] Event Completed.`);
}