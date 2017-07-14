import { Injectable, Injector } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';

import { ModalsService } from '../../modals/modals.service';
import { RPCService } from '../../core/rpc/rpc.service';
import { PeerService } from '../../core/rpc/peer.service';

@Injectable()
export class StatusService {

  private _subBlockInternal: Subscription;
  private _subBlockNetwork: Subscription;
  private _modalsService: ModalsService;

  private highestBlockHeightNetwork: number = -1;
  private highestBlockHeightInternal: number = -1;
  private startingBlockCount: number = -1;
  private totalRemainder: number = -1;

  public statusUpdates: Subject<any> = new Subject<any>();
  private status: any = {
    syncPercentage: 0,
    remainingBlocks: undefined,
    lastBlockTime: undefined,
    increasePerMinute: 0,
    estimatedTimeLeft: undefined,
    manuallyOpened: false
  };

  constructor(
    private _peerService: PeerService,
    private _rpcService: RPCService,
    private _injector: Injector
  ) {
    this._subBlockInternal = this._peerService.getBlockCount()
      .subscribe(
        height => {
          // TODO lastBlockTime
          const lastBlockTime = new Date();
          this.calculateSyncingDetails(lastBlockTime, height);
          this.highestBlockHeightInternal = height;
          this.status.lastBlockTime = lastBlockTime;
          if (this.startingBlockCount === -1) {
            this.startingBlockCount = height;
          }
        },
        error => console.log('SyncingComponent subscription error:' + error));
    this._subBlockNetwork = this._peerService.getBlockCountNetwork()
      .subscribe(
        height => {
          this.highestBlockHeightNetwork = height;
          if (this.totalRemainder === -1 && this.startingBlockCount !== -1) {
            this.totalRemainder = height - this.startingBlockCount;
          }
        },
        error => console.log('SyncingComponent subscription error:' + error));
    this._rpcService.poll();
  }

  setManuallyOpened() {
    this.status.manuallyOpened = true;
  }

  calculateSyncingDetails(newTime: Date, newHeight: number) {

    const internalBH = this.highestBlockHeightInternal;
    const networkBH = this.highestBlockHeightNetwork;

    if (internalBH < 0 || networkBH < 0) {
      this.status.syncPercentage = 0;
      return ;
    }

    // remainingBlocks
    this.status.remainingBlocks = networkBH - internalBH;

    // syncPercentage
    this.status.syncPercentage = internalBH / networkBH * 100;
    if (this.status.syncPercentage > 100) {
      this.status.syncPercentage = 100;
    }

    const timeDiff: number = newTime.getTime() - this.status.lastBlockTime.getTime();
    const blockDiff: number = newHeight - this.highestBlockHeightInternal;

    // increasePerMinute
    if (timeDiff > 0) {
      const increasePerMinute = blockDiff / this.totalRemainder * 100 * (60 * 1000 / timeDiff);
      if (increasePerMinute < 100) {
        this.status.increasePerMinute = +increasePerMinute.toFixed(2);
      } else {
        this.status.increasePerMinute = 100;
      }
    }

    // timeLeft
    if (blockDiff > 0) {
      this.estimateTimeLeft(blockDiff, timeDiff);
    }

    // Open syncing Modal
    if (networkBH <= 0 || internalBH <= 0 || networkBH - internalBH > 50) {
      if (!this._modalsService) {
        this._modalsService = this._injector.get(ModalsService);
      }
      if (!this._modalsService.modal) {
        this._modalsService.open('syncing');
      }
    }

    // update
    this.statusUpdates.next(this.status);
  }

  getRemainder() {
    const diff = this.highestBlockHeightNetwork - this.highestBlockHeightInternal;
    return (diff < 0 ? 0 : diff);
  }

  // TODO: average out the estimated time left to stop random shifting when slowed down.
  // and localize
  estimateTimeLeft(blockDiff: number, timeDiff: number) {

    let returnString = '';

    const secs = Math.floor((this.getRemainder() / blockDiff * timeDiff) / 1000);
    const seconds = Math.floor(secs % 60);
    const minutes = Math.floor((secs / 60) % 60);
    const hours = Math.floor((secs / 3600) % 3600);

    if (hours > 0) {
      returnString += `${hours} ${hours > 1 ? 'hours' : 'hour'} `
    }
    if (minutes > 0) {
      returnString += `${minutes} ${minutes > 1 ? 'minutes' : 'minute'} `
    }
    if (seconds > 0) {
      returnString += `${seconds} ${seconds > 1 ? 'seconds' : 'second'}`
    }
    if (returnString === '') {
      returnString = '∞';
    }

    this.status.estimatedTimeLeft = returnString;
  }
}
