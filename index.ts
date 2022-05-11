/**
 * @file libCaver.ts
 * @notice caver v1.8 library (based on TS)
 * @author jhhong
 */

import Caver from "caver-js";
/// caver-js-ext-kas는 현재 ts를 아예 지원하지 않는다.
let CaverExtKas = require("caver-js-ext-kas");
/// Logger
import { Logger } from "tslog";

/// Interface 정의
export interface RawTxConfig {
    from: string;      // Transaction 생성자
    nonce: string;     // from의 nonce값
    gas: string;       // Transaction Gas 양
    chainId: string;   // 블록체인 chain ID
    account?: any;     // account 정보 (accountUpdate Tx Only)
    input?: string;    // Transaction Input field Payload
    feeRatio?: number; // 대납 비율
    to?: string;       // Transaction 대상자
    value?: string;    // Transaction에 동봉될 KLAY 양
}
export interface IfcbHash {
    (hash: string): void;
}
export interface IfcbReceipt {
    (receipt: any): void;
}
export interface IfcbError {
    (error: any): void;
}
export interface KasKey {
    accessKey: string;
    secretAccessKey: string;
}
export type ProviderInfo = string | KasKey;

/// CLASS
export class LibCaver {

    chainId: string = "";
    caver: any;
    logger: Logger = new Logger({minLevel: "debug"});

    /**
     * @notice 객체를 초기화한다.
     * @param chainId 체인 ID
     * @param useHttp Http 사용 여부
     * @param providerInfo 서비스프로바이더 URL 혹은 KAS Key
     */
    public async initialize(
        chainId: string,
        useHttp: boolean,
        providerInfo: ProviderInfo
    ): Promise<void> {
        try {
            this.chainId = chainId;
            if(typeof providerInfo == "string") { // node provider
                this.caver = new Caver(providerInfo);
            } else {
                let flag1: boolean = (typeof providerInfo.accessKey == "string");
                let flag2: boolean = (typeof providerInfo.secretAccessKey == "string");
                if (flag1 && flag2) { // kas provider
                    this.caver = new CaverExtKas(
                        chainId,
                        providerInfo.accessKey,
                        providerInfo.secretAccessKey,
                    {useNodeAPIWithHttp: useHttp});
                } else {
                    throw new Error(`Invalid KasKey info`);
                }
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: initialize`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
        }
    }

    /**
     * @notice keyring을 wallet에 추가한다.
     * @param keyring keyring Object
     * @returns 추가된 keyring object (실패 시 null)
     */
    public async addToWallet(keyring: any): Promise<any> {
        try {
            if(!this.caver.wallet.isExisted(keyring.address)) {
                return this.caver.wallet.add(keyring);
            } else {
                return keyring;
            }
        } catch(error: any) {
            let action = `Action: addToWallet`;
            this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
            return null;
        }
    }

    /**
     * @notice 컨트랙트 Object를 생성한다.
     * @param abi 컨트랙트 ABI (Application Binary Interface)
     * @return contract Object
     */
    public createContract(abi: any): any {
        return this.caver.contract.create(abi);
    }

    /**
     * @notice 새로운 Keyring을 생성한다.
     * @dev keyring type: SingleKeyring, binded address: 무작위
     * Ethereum용 주소가 생성됨 (Keypair와 Address가 강결합 상태)
     * @return DefaultKeyring
     */
    public createDefaultKeyring(): any {
        try {
            return this.caver.wallet.keyring.generate();
        } catch(error: any) {
            let action = `Action: createDefaultKeyring`;
            this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
            return null;
        }
    }

    /**
     * @notice MultipleKeyring을 생성한다.
     * @param address binding할 address
     * @param privKeys binding할 private key array
     * @return MultipleKeyring
     */
    public createMultipleKeyring(
        address: string,
        privKeys: string[]
    ): any {
        if(privKeys.length > 1) {
            return this.caver.wallet.keyring.create(address, privKeys);
        }
        return null;
    }

    /**
     * @notice RoleBasedKeyring을 생성한다.
     * @param address binding할 address
     * @param privKeys binding할 private key array (2차원 배열)
     * @return RoleBasedKeyring
     */
    public createRoleBasedKeyring(
        address: string,
        privKeys: string[][]
    ): any {
        if(privKeys.length == 3) {
            return this.caver.wallet.keyring.create(address, privKeys);
        }
        return null;
    }

    /**
     * @notice SingleKeyring을 생성한다.
     * @param address binding할 address
     * @param privKey binding할 private key
     * @return SingleKeyring
     */
    public createSingleKeyring(
        address: string,
        privKey: string
    ): any {
        return this.caver.wallet.keyring.create(address, privKey);
    }

    /**
     * @notice 트랜젝션 decode를 수행한다.
     * @param rlpEncoded 서명된 transaction의 RLP encoding Data
     * @return signed transaction object
     */
    public decodeTransaction(rlpEncoded: string): any {
        return this.caver.transaction.decode(rlpEncoded);
    }

    /**
     * @notice keyring에서 keystore을 export한다.
     * @param keyring keyring Object
     * @param passwd password
     * @return keystore Object
     */
    public exportKeystore(
        keyring: any,
        passwd: string
    ): any {
        return keyring.encrypt(passwd);
    }


    /**
     * @notice 새로운 private key를 지정한 개수만큼 생성한다.
     * @param num 생성할 private key 개수
     * @return private keys (String Array)
     */
    public generateMultipleKeys(num: number): string[] {
        return this.caver.wallet.keyring.generateMultipleKeys(num);
    }

    /**
     * @notice 새로운 private key를 배열에 명시한 개수만큼 생성한다.
     * @param numArray 생성할 private key 개수 정보를 담을 배열 (must length == 3)
     * @dev numArray length == 3 (must: [roleTransactionKey, roleAccountUpdateKey, roleFeePayerKey])
     * ex. numArray: [3, 1, 2] means..
     * - roleTransactionKey용 PrivateKey: 3개
     * - roleAccountUpdateKey용 PrivateKey: 1개
     * - roleFeePayerKey용 PrivateKey: 2개
     * @return private keys (2D String Array)
     */
    public generateRoleBasedKeys(numArray: number[]): string[][] {
        if(numArray.length == 3) {
            return this.caver.wallet.keyring.generateRoleBasedKeys(numArray);
        }
        return [];
    }

    /**
     * @notice 새로운 private key를 생성한다.
     * @return private key (String)
     */
    public generateSingleKey(): string {
        return this.caver.wallet.keyring.generateSingleKey();
    }

    /**
     * @notice account의 상세정보를 반환한다.
     * @param address account의 address
     * @return account 상세 정보 (json object)
     * @dev await 필수: json-rpc query를 통해 값 얻어옴
     */
    public getAccount(address: string): any {
        return this.caver.rpc.klay.getAccount(address);
    }

    /**
     * @notice account의 KLAY 보유량을 반환한다.
     * @param address account의 address
     * @return account의 KLAY 보유량
     * @dev await 필수: json-rpc query를 통해 값 얻어옴
     */
    public getBalance(address: string): string {
        return this.caver.rpc.klay.getBalance(address);
    }

    /**
     * @notice address의 nonce값을 얻어온다.
     * @param address account address
     * @return address의 nonce값
     * @dev await 필수: json-rpc query를 통해 값 얻어옴
     */
    public getNonce(address: string): string {
        return this.caver.rpc.klay.getTransactionCount(address);
    }

    /**
     * @notice keyring의 private key를 반환한다.
     * @param keyring keyring Object
     * @return private key
     * @dev 미구현
     */
    public getPrivateKey(): string {
        return '0';
    }

    /**
     * @notice keyring의 public key를 반환한다.
     * @param keyring keyring Object
     * @return public key
     */
    public getPublicKey(keyring: any): string {
        return keyring.getPublicKey();
    }

    /**
     * @notice keyring의 wallet key를 반환한다.
     * @param keyring keyring Object
     * @return wallet key
     * @dev 미구현
     */
    public getWalletKey(): string {
        return '0';
    }

    /**
     * @notice 컨트랙트 Object를 가져온다.
     * @param abi 컨트랙트 ABI (Application Binary Interface)
     * @param ca 컨트랙트 주소
     * @return contract Object
     */
    public importContract(
        abi: any,
        ca: string
    ): any {
        return this.caver.contract.create(abi, ca);
    }

    /**
     * @notice keystore에서 keyring을 import한다.
     * @param keystore keystore Object
     * @param passwd password
     * @return keyring
     */
    public importKeystore(
        keystore: any,
        passwd: string
    ): any {
        return this.caver.wallet.keyring.decrypt(keystore, passwd);
    }

    /**
     * @notice address가 Wallet에 추가된 상태인지의 여부를 반환한다.
     * @param address Wallet 추가 여부를 확인할 address
     * @return boolean (true: added, false: removed)
     */
    public isWalletExisted(address: string): boolean {
        return this.caver.wallet.isExisted(address);
    }

    /**
     * KLAY를 peb 단위로 변환한다.
     * @param amount peb단위로 변환할 KLAY 양
     * @return peb 단위로 변환된 값
     * @author jhhong
     */
    public klayToPeb(amount: string): string {
        return this.caver.utils.convertToPeb(amount, 'KLAY');
    }

    /**
     * @notice AccountUpdate Raw transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param account Account Instance
     * @param nonce from의 nonce값
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxAccountUpdate(
        from: string,
        account: any,
        nonce: string,
        gas: string,
        chainId: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw TX (accountUpdate)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.silly(`.... account = [${account}]`);
            this.logger.debug(`.... feeRatio = [${feeRatio}]`);
            let txObj: RawTxConfig = {
                from: from,
                account: account,
                gas: gas,
                nonce: nonce,
                chainId: chainId
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.accountUpdate.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedAccountUpdate.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedAccountUpdateWithRatio.create(txObj);
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: makeTxAccountUpdate`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }

    }

    /**
     * @notice Cancel Raw transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param nonce from의 nonce값 (취소할 nonce 값)
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxCancel(
        from: string,
        nonce: string,
        gas: string,
        chainId: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw TX (cancel)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.debug(`.... feeRatio = [${`${feeRatio}`}]`);
            let txObj: RawTxConfig = {
                from: from,
                gas: gas,
                nonce: nonce,
                chainId: chainId
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.cancel.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedCancel.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedCancelWithRatio.create(txObj);
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: makeTxCancel`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice ChainDataAnchoring Raw transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param nonce from의 nonce값 (취소할 nonce 값)
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param data transaction input data
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxChainDataAnchoring(
        from: string,
        nonce: string,
        gas: string,
        chainId: string,
        data: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw Tx (Anchoring)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.silly(`.... data = [${data}]`);
            this.logger.debug(`.... feeRatio = [${`${feeRatio}`}]`);
            let txObj: RawTxConfig = {
                from: from,
                gas: gas,
                nonce: nonce,
                chainId: chainId,
                input: data
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.chainDataAnchoring.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedChainDataAnchoring.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedChainDataAnchoringWithRatio.create(txObj);
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: makeTxChainDataAnchoring`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice SmartContractDeploy Raw transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param value transaction을 통해 전송할 KLAY
     * @param nonce from의 nonce값
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param data transaction input data
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxSmartContractDeploy(
        from: string,
        value: string,
        nonce: string,
        gas: string,
        chainId: string,
        data: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw TX (smartContractDeploy)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... value = [${value}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.silly(`.... data = [${data}]`);
            this.logger.debug(`.... feeRatio = [${`${feeRatio}`}]`);
            let txObj: RawTxConfig = {
                from: from,
                gas: gas,
                nonce: nonce,
                value: value,
                chainId: chainId,
                input: data
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.smartContractDeploy.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedSmartContractDeploy.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedSmartContractDeployWithRatio.create(txObj);
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: makeTxSmartContractDeploy`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice SmartContractExecution Raw transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param to transaction 대상 주소
     * @param value transaction을 통해 전송할 KLAY
     * @param nonce from의 nonce값
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param data transaction input data
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxSmartContractExecution(
        from: string,
        to: string,
        value: string,
        nonce: string,
        gas: string,
        chainId: string,
        data: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw TX (smartContractExecution)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... to = [${to}]`);
            this.logger.debug(`.... value = [${value}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.silly(`.... data = [${data}]`);
            this.logger.debug(`.... feeRatio = [${`${feeRatio}`}]`);
            let txObj: RawTxConfig = {
                from: from,
                to: to,
                gas: gas,
                nonce: nonce,
                value: value,
                chainId: chainId,
                input: data
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.smartContractExecution.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedSmartContractExecution.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedSmartContractExecutionWithRatio.create(txObj);
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: makeTxSmartContractExecution`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice ValueTransfer Raw Transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param to transaction 대상 주소
     * @param value transaction을 통해 전송할 KLAY
     * @param nonce from의 nonce값
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxValueTransfer(
        from: string,
        to: string,
        value: string,
        nonce: string,
        gas: string,
        chainId: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw TX (valueTransfer)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... to = [${to}]`);
            this.logger.debug(`.... value = [${value}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.debug(`.... feeRatio = [${`${feeRatio}`}]`);
            let txObj: RawTxConfig = {
                from: from,
                to: to,
                gas: gas,
                nonce: nonce,
                value: value,
                chainId: chainId
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.valueTransfer.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedValueTransfer.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedValueTransferWithRatio.create(txObj);
            }
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: makeTxValueTransfer`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice ValueTransferMemo Raw Transaction을 생성한다.
     * @param from transaction 생성자 주소
     * @param to transaction 대상 주소
     * @param value transaction을 통해 전송할 KLAY
     * @param nonce from의 nonce값
     * @param gas transaction 처리에 소모될 gas양
     * @param chainId 체인 ID
     * @param data transaction input data
     * @param feeRatio 수수료 대납비율 (0: 대납X, 1 ~ 99: Partial FD, 100: Full FD), 디폴트=0
     * @return raw transaction
     */
    public async makeTxValueTransferMemo(
        from: string,
        to: string,
        value: string,
        nonce: string,
        gas: string,
        chainId: string,
        data: string,
        feeRatio: number = 0
    ): Promise<any> {
        try {
            this.logger.debug(`#### "Raw TX (valueTransferMemo)"`);
            this.logger.debug(`.... from = [${from}]`);
            this.logger.debug(`.... to = [${to}]`);
            this.logger.debug(`.... value = [${value}]`);
            this.logger.debug(`.... nonce = [${nonce}]`);
            this.logger.debug(`.... gas = [${gas}]`);
            this.logger.debug(`.... chainId = [${chainId}]`);
            this.logger.silly(`.... data = [${data}]`);
            this.logger.debug(`.... feeRatio = [${`${feeRatio}`}]`);
            let txObj: RawTxConfig = {
                from: from,
                to: to,
                gas: gas,
                nonce: nonce,
                value: value,
                chainId: chainId,
                input: data
            };
            switch(feeRatio) {
                case 0:
                    return this.caver.transaction.valueTransferMemo.create(txObj);
                case 100:
                    return this.caver.transaction.feeDelegatedValueTransferMemo.create(txObj);
                default:
                    txObj.feeRatio = feeRatio;
                    return this.caver.transaction.feeDelegatedValueTransferMemoWithRatio.create(txObj);
            }
        } catch(error: any) {
            let action = `Action: makeTxValueTransferMemo`;
            this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
            return null;
        }
    }

    /**
     * @notice address에 해당하는 keyring을 wallet에서 제거한다.
     * @param address 제거할 keyring의 address
     * @return boolean
     */
    public removeFromWallet(address: string): boolean {
        return this.caver.wallet.remove(address);
    }

    /**
     * @notice 서명까지 완료된 Raw Tx를 블록체인에 쓰기위해 Provider에 전송한다.
     * @param rlpEncoded 서명까지 완료된 Raw Tx
     * @param cbHash Transaction Hash 생성 완료 시 호출될 콜백함수
     * @param cbReceipt Transaction Receipt 발행 완료 시 호출될 콜백함수
     * @param cbError Error 발생 시 호출될 콜백함수
     * @author jhhong
     */
    public async sendRawTransaction(
        rlpEncoded: string,
        cbHash: IfcbHash,
        cbReceipt: IfcbReceipt,
        cbError: IfcbError
    ) {
        try {
            await this.caver.rpc.klay.sendRawTransaction(rlpEncoded)
            .on('transactionHash', async function(txHash: string) {
                if (cbHash != null) {
                    cbHash(txHash);
                }
            })
            .on('receipt', async function(receipt: any) {
                if (cbReceipt != null) {
                    cbReceipt(receipt);
                }
            })
            .on('error', async function(error: any) {
                if (cbError != null) {
                    cbError(error);
                }
            });
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: sendRawTransaction`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
        }
    }

    /**
     * @notice message에 서명한다.
     * @param address 서명자의 주소
     * @param message 서명할 메시지
     * @returns Signature
     * @dev address는 반드시 wallet에 add되어 있어야 한다.
     */
    public async signMessage(
        address: string,
        message: string
    ): Promise<string | null> {
        try {
            if(this.caver.wallet.isExisted(address) == false) {
                throw new Error(`addToWallet need!: [${address}]`);
            }
            let ret = await this.caver.wallet.signMessage(address, message, this.caver.wallet.keyring.role.roleTransactionKey);
            let r = (ret.signatures[0].r).split('0x')[1];
            let s = (ret.signatures[0].s).split('0x')[1];
            let v = (ret.signatures[0].v).split('0x')[1];
            return (`0x${r}${s}${v}`);
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: signMessage`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice Transaction에 서명한다.
     * @param address 서명자의 주소
     * @param rawTx Raw Transaction 정보
     * @returns 서명된 Transaction의 RLP Encoding Data
     * @dev address는 반드시 wallet에 add되어 있어야 한다.
     */
    public async signTransaction(
        address: string,
        rawTx: any
    ): Promise<string | null> {
        try {
            if(this.caver.wallet.isExisted(address) == false) {
                throw new Error(`addToWallet need!: [${address}]`);
            }
            let signed = await this.caver.wallet.sign(address, rawTx);
            return signed.getRLPEncoding();
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: signTransaction`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * @notice Transaction에 Fee-Payer로서 서명을 수행한다.
     * @param payer Fee-Payer의 주소
     * @param rawTx Raw Transaction 정보
     * @returns Fee-Payer 서명까지 완료된 Transaction의 RLP Encoding Data
     * @dev payer는 반드시 wallet에 add되어 있어야 한다.
     */
    public async signAsFeePayer(
        payer: string,
        rawTx: any
    ): Promise<string | null> {
        try {
            if(this.caver.wallet.isExisted(payer) == false) {
                throw new Error(`addToWallet need!: [${payer}]`);
            }
            let signed = await this.caver.wallet.signAsFeePayer(payer, rawTx);
            return signed.getRLPEncoding();
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: signAsFeePayer`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }

    /**
     * 10진수를 16진수로 변환한다.
     * @param value 16진수로 변환할 10진수
     * @return 16진수 (string)
     */
    public toHex(value: string): string {
        return this.caver.utils.toHex(value);
    }

    /**
     * @notice 주어진 KLAY를 peb으로 변환한다.
     * @param value peb으로 변환할 KLAY값
     * @return 변환된 peb값
     */
    public toPeb(value: string): string {
        return this.caver.utils.convertToPeb(value, 'KLAY');
    }

    /**
     * @notice 주어진 peb을 KLAY로 변환한다.
     * @param value KLAY로 변환할 peb값
     * @return 변환된 KLAY값
     */
    public toKlay(value: string): string {
        return this.caver.utils.convertFromPeb(value, 'KLAY');
    }

    /**
     * @notice keyring을 교체한다.
     * @param keyring 교체할 keyring object
     * @return 교체된 keyring object or null (실패시)
     * @dev keyring.address에 해당하는 keyring이 wallet에 add되어 있어야 한다.
     */
    public async updateOnWallet(keyring: any): Promise<any> {
        try {
            if(!this.caver.wallet.isExisted(keyring.address)) {
                throw new Error(`not added in wallet [${keyring.address}]`);
            }
            return this.caver.wallet.updateKeyring(keyring);
        } catch(error) {
            if (error instanceof Error) {
                if(typeof error.stack == 'string') {
                    let action = `Action: updateOnWallet`;
                    this.logger.error(`exception occured!:\n${action}\n${error.stack}`);
                }
            }
            return null;
        }
    }
}
 
 