// import { DatabaseManager, EventContext, StoreContext } from '@subsquid/hydra-common';
// import {  Account, Auction, AuctionParachain, Bid,
//           Chronicle, CrowdloanSequence, Contribution,
//           Parachain, ParachainLeases, Crowdloan as ModelCrowdloan, HistoricalBalance
//         } from '../generated/model';
// import {  Auctions,
//   //  Balances, 
//           Registrar, Slots, 
//           Crowdloan as TypeCrowdloan 
//         } from '../types';
// import { apiService  } from './api';



// export async function handleParachainRegistration({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {

//   const [paraId, managerId] = new Registrar.RegisteredEvent(event).params;

//   const parachain = await getOrCreate(store, Parachain, `${paraId}-${managerId.toHex()}`);

//   let api = await apiService()
//   const { deposit } = (await api.query.registrar.paras(paraId)).toJSON() || { deposit: 0 };
//   parachain.paraId = paraId.toNumber();
//   parachain.createdAt = new Date(block.timestamp);
//   parachain.manager = managerId.toHex();
//   parachain.deposit = deposit;
//   parachain.creationBlock = block.height;
//   parachain.deregistered = false;

//   await store.save(parachain);
// };

// export async function handleAuctionStarted({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {

//   const [auctionId, slotStart, auctionEnds] = new Auctions.AuctionStartedEvent(event).params;

//   let api = await apiService();
//   const endingPeriod = api.consts.auctions.endingPeriod.toJSON() as number;
//   const leasePeriod = api.consts.slots.leasePeriod.toJSON() as number;
//   const periods = api.consts.auctions.leasePeriodsPerSlot.toJSON() as number;

//   const auction = await getOrCreate(store, Auction, auctionId.toString());

//   auction.blockNum = block.height;
//   auction.status = 'Started';
//   auction.slotsStart = slotStart.toNumber();
//   auction.slotsEnd = slotStart.toNumber() + periods - 1;
//   auction.leaseStart = slotStart.toNumber() * leasePeriod;
//   auction.leaseEnd = (slotStart.toNumber() + periods - 1) * leasePeriod;
//   // auction.createdAt = new Date(block.timestamp);
//   auction.closingStart = auctionEnds.toNumber();
//   auction.ongoing = true;
//   auction.closingEnd = auctionEnds.toNumber() + endingPeriod;
//   await store.save(auction);

//   const chronicle = await getOrCreate(store, Chronicle, 'ChronicleKey');
//   chronicle.curAuctionId = auctionId.toString();
//   await store.save(chronicle);
// };


// export async function handleAuctionClosed({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {

//   const [auctionId] = new Auctions.AuctionClosedEvent(event).params;
//   const auction = await getOrCreate(store, Auction, auctionId.toString());

//   auction.blockNum = block.height;
//   auction.status = 'Closed';
//   auction.ongoing = false;
//   await store.save(auction);

//   const chronicle = await getOrCreate(store, Chronicle, 'ChronicleKey');
//   chronicle.curAuctionId = auctionId.toString();
//   await store.save(chronicle);
// };


// export async function handleBidAccepted({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {

//   const [bidderId, paraId, bidAmount, startSlot, endSlot] = new Auctions.BidAcceptedEvent(event).params;

//   let api = await apiService();
//   const auctionId = (await api.query.auctions.auctionCounter()).toJSON() as number;
//   const isFund = isFundAddress(bidderId.toHex()) as unknown as boolean;
//   const bid = await getOrCreate(store, Bid, `${block.height}-${bidderId}-${paraId}-${startSlot}-${endSlot}`);

//   const fundId = await getLatestCrowdloanId(paraId.toString(), store);

//   bid.id = `${block.height}-${bidderId}-${paraId}-${startSlot}-${endSlot}`;
//   bid.auction.id = auctionId.toString();
//   bid.blockNum = block.height;
//   bid.winningAuction = auctionId;
//   bid.parachain.id = paraId.toString();
//   bid.isCrowdloan = isFund;
//   bid.amount = BigInt(bidAmount.toNumber());
//   bid.firstSlot = startSlot.toNumber();
//   bid.lastSlot = endSlot.toNumber();
//   bid.createdAt = new Date(block.timestamp);
//   // bid.fund.id = isFund ? fundId : '';
//   bid.bidder = isFund ? '' : bidderId.toHex();

//   await store.save(bid);

//   const auctionParaId = `${paraId}-${startSlot}-${endSlot}-${auctionId}`;
//   const auctionPara = await store.get(AuctionParachain,{
//     where: { auctionParaId }
//   });
//   if (!auctionPara) {
//     await store.save(new AuctionParachain({
//       id: auctionParaId,
//       firstSlot: startSlot.toNumber(),
//       lastSlot: endSlot.toNumber(),
//       createdAt: new Date(block.timestamp),
//       blockNum: block.height
//     }))
//   }
// };


// const getLatestCrowdloanId = async (parachainId: string, store: DatabaseManager) => {

//   const sequence = await store.get(CrowdloanSequence,{
//     where: { parachainId }
//   })
//   let api = await apiService();
//   // (await api.query.auctions.auctionCounter()).toJSON() as number;
//   const curBlockNum = await api.query.system.number() as unknown as number;
//   if (sequence) {
//     const crowdloanIdx = sequence.curIndex;
//     const isReCreateCrowdloan = await getIsReCreateCrowdloan(`${parachainId}-${crowdloanIdx}`, store);
//     let curIdex = crowdloanIdx;
//     if (isReCreateCrowdloan) {
//       curIdex = crowdloanIdx + 1;
//       sequence.curIndex = curIdex;
//       sequence.blockNum = curBlockNum;
//       await store.save(sequence);
//     }
//     return `${parachainId}-${curIdex}`;
//   }
//   else {
//     let sequence = await getOrCreate(store, CrowdloanSequence, parachainId)
//     sequence.id = parachainId
//     sequence.curIndex = 0
//     sequence.createdAt = new Date()
//     sequence.blockNum = curBlockNum
//     await store.save(sequence)
//   }
//   return `${parachainId}-0`;
// };


// const getIsReCreateCrowdloan = async (fundId: string, store: DatabaseManager): Promise<Boolean> => {
//   const fund = await store.find(ModelCrowdloan, {
//     where: {
//         id: fundId,
//     },
//     take: 1
//   })
//   const isReCreateCrowdloan = !!(
//     fund[0]?.dissolvedBlock &&
//     fund[0]?.status === 'Dissolved' &&
//     fund[0]?.isFinished
//   );
//   return isReCreateCrowdloan;
// };


// export async function handleCrowdloanContributed({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {

//   const [contributorId, fundIdx, amount] = new TypeCrowdloan.ContributedEvent(event).params
//   const amtValue = amount.toNumber()

//   const contribution = await store.find(Contribution, 
//   {
//     where: `${block.height}-${event.id}`,
//     take: 1
//   })

//   let api = await apiService();
//   const parachain = (await api.query.registrar.paras(fundIdx)).toJSON();

//   contribution[0].account = contributorId.toHex();
//   contribution[0].fund.id = fundIdx.toString();
//   contribution[0].parachain.id = parachain.id;
//   contribution[0].amount = BigInt(amtValue);
//   contribution[0].createdAt = new Date(block.timestamp);
//   contribution[0].blockNum = block.height;

//   await store.save(contribution);
// };


// export async function handleCrowdloanDissolved({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {
//   const [fundId] = new TypeCrowdloan.DissolvedEvent(event).params;

//   const crowdloan = await store.find(ModelCrowdloan, {where: { id: fundId.toString() }, take: 1});

//   crowdloan[0].status = 'Dissolved';
//   crowdloan[0].isFinished = true;
//   crowdloan[0].updatedAt = new Date(block.timestamp);
//   crowdloan[0].dissolvedBlock = block.height;

//   await store.save(crowdloan);
// };


// export async function handleNewLeasePeriod({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {
//   const [leaseIdx] = new Slots.NewLeasePeriodEvent(event).params;
//   const api = await apiService();
//   const leasePeriod = api.consts.slots.leasePeriod.toJSON() as number;
  
//   let chronicle = await getOrCreate(store, Chronicle, 'ChronicleKey');

//   const timestamp: number = Math.round(block.timestamp / 1000);
//   chronicle.curLease = leaseIdx.toNumber();
//   chronicle.curLeaseStart = timestamp;
//   chronicle.curLeaseEnd = timestamp + leasePeriod - 1;

//   await store.save(chronicle);
// };

// export async function handleLeasedSlot({
//   store,
//   event,
//   block,
// }: EventContext & StoreContext): Promise<void> {

//   const [paraId, from, firstLease, leaseCount, extra, total] = new Slots.LeasedEvent(event).params;
//   const lastLease = firstLease.toNumber() + leaseCount.toNumber() - 1;
//   const totalUsed = total.toString();
//   console.log(" totalUsed ::: ",totalUsed)
//   const extraAmount = extra.toString();
//   console.log(" extraAmount ::: ",extraAmount)

//   console.log(" block.height ::: ",block.height)
//   const [ongoingAuction] = await store.find(Auction, {where: {ongoing: true}, take: 1});
//   console.log(" ongoingAuction ::: ",ongoingAuction)
//   const curAuction = ongoingAuction || { id: 'unknown', resultBlock: block.height, leaseEnd: null };


//   console.log(" curAuction ::: ",curAuction)

//   if (curAuction.id === 'unknown') {
//     await store.save(new Auction({
//       id: 'unknown',
//       blockNum: block.height,
//       status: 'Closed',
//       slotsStart: 0,
//       slotsEnd: 0,
//       closingStart: 0,
//       closingEnd: 0,
//       ongoing: false
//     }));
//   }

//   if (await isFundAddress(from.toString())) {
//     console.group(" 2. curAuction ::: ",curAuction)
//     let crowdloan = await store.find(ModelCrowdloan, {where: {id: paraId.toString() }, take: 1});
//     console.log(" crowdloan :::: ",crowdloan)
//     if(crowdloan.length != 0) {
//       crowdloan[0].status = 'Won';
//       crowdloan[0].wonAuctionId = curAuction.id;
//       crowdloan[0].leaseExpiredBlock = curAuction.leaseEnd;
  
//       await store.save(crowdloan);
//     }
//   }

//   console.log(" 3. curAuction ::: ",curAuction)
//   const { id: auctionId, resultBlock } = curAuction;
//   console.log(" resultBlock ::: ",resultBlock)
//   console.log(" auctionId ::: ",auctionId, typeof auctionId)
//   console.log(`${paraId}-${auctionId != 'unknown' ? auctionId : 'sudo'}-${firstLease}-${lastLease}`)
//   console.log(" auctionId ::: ",auctionId)
 
//   const parachainLeases = await store.find(ParachainLeases, {where: `${paraId}-${auctionId != 'unknown' ? auctionId : 'sudo'}-${firstLease}-${lastLease}`});
  
//   parachainLeases[0].id = paraId.toString();
//   parachainLeases[0].leaseRange = `${auctionId != 'unknown' ? auctionId : 'sudo'}-${firstLease}-${lastLease}`;
//   parachainLeases[0].firstLease = firstLease.toNumber();
//   parachainLeases[0].lastLease = lastLease;
//   parachainLeases[0].latestBidAmount = BigInt(totalUsed);
//   parachainLeases[0].parachain.id = paraId.toString();
//   parachainLeases[0].extraAmount = BigInt(extraAmount);
//   parachainLeases[0].winningAmount = BigInt(totalUsed);
//   parachainLeases[0].wonBidFrom = from.toHex();
//   parachainLeases[0].winningResultBlock = resultBlock,
//   parachainLeases[0].hasWon = true;

//   await store.save(parachainLeases);
// };



// /*           generic functions      */