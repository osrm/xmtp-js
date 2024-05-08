import { createConsentMessage } from '@xmtp/consent-proof-signature'
import { invitation } from '@xmtp/proto'
import Client from '@/Client'
import { Contacts } from '@/Contacts'
import { WalletSigner } from '@/crypto/Signature'
import { newLocalHostClient, newWallet } from './helpers'

const alice = newWallet()
const bob = newWallet()
const carol = newWallet()

let aliceClient: Client
let bobClient: Client
let carolClient: Client

describe('Contacts', () => {
  beforeEach(async () => {
    aliceClient = await Client.create(alice, {
      env: 'local',
    })
    bobClient = await Client.create(bob, {
      env: 'local',
    })
    carolClient = await Client.create(carol, {
      env: 'local',
    })
  })

  it('should initialize with client', async () => {
    expect(aliceClient.contacts).toBeInstanceOf(Contacts)
    expect(aliceClient.contacts.addresses).toBeInstanceOf(Set)
    expect(Array.from(aliceClient.contacts.addresses.keys()).length).toBe(0)
  })

  it('should allow and deny addresses', async () => {
    await aliceClient.contacts.allow([bob.address])
    expect(aliceClient.contacts.consentState(bob.address)).toBe('allowed')
    expect(aliceClient.contacts.isAllowed(bob.address)).toBe(true)
    expect(aliceClient.contacts.isDenied(bob.address)).toBe(false)

    await aliceClient.contacts.deny([bob.address])
    expect(aliceClient.contacts.consentState(bob.address)).toBe('denied')
    expect(aliceClient.contacts.isAllowed(bob.address)).toBe(false)
    expect(aliceClient.contacts.isDenied(bob.address)).toBe(true)
  })

  it('should allow an address when a conversation is started', async () => {
    const conversation = await aliceClient.conversations.newConversation(
      carol.address
    )

    expect(aliceClient.contacts.consentState(carol.address)).toBe('allowed')
    expect(aliceClient.contacts.isAllowed(carol.address)).toBe(true)
    expect(aliceClient.contacts.isDenied(carol.address)).toBe(false)

    expect(conversation.isAllowed).toBe(true)
    expect(conversation.isDenied).toBe(false)
    expect(conversation.consentState).toBe('allowed')
  })

  it('should allow an address when a conversation has an unknown consent state and a message is sent into it', async () => {
    await aliceClient.conversations.newConversation(carol.address)

    expect(carolClient.contacts.consentState(alice.address)).toBe('unknown')
    expect(carolClient.contacts.isAllowed(carol.address)).toBe(false)
    expect(carolClient.contacts.isDenied(carol.address)).toBe(false)

    const carolConversation = await carolClient.conversations.newConversation(
      alice.address
    )
    expect(carolConversation.consentState).toBe('unknown')
    expect(carolConversation.isAllowed).toBe(false)
    expect(carolConversation.isDenied).toBe(false)

    await carolConversation.send('gm')

    expect(carolConversation.consentState).toBe('allowed')
    expect(carolConversation.isAllowed).toBe(true)
    expect(carolConversation.isDenied).toBe(false)
  })

  it('should allow or deny an address from a conversation', async () => {
    const conversation = await aliceClient.conversations.newConversation(
      carol.address
    )

    await conversation.deny()

    expect(aliceClient.contacts.consentState(carol.address)).toBe('denied')
    expect(aliceClient.contacts.isAllowed(carol.address)).toBe(false)
    expect(aliceClient.contacts.isDenied(carol.address)).toBe(true)

    expect(conversation.isAllowed).toBe(false)
    expect(conversation.isDenied).toBe(true)
    expect(conversation.consentState).toBe('denied')

    await conversation.allow()

    expect(aliceClient.contacts.consentState(carol.address)).toBe('allowed')
    expect(aliceClient.contacts.isAllowed(carol.address)).toBe(true)
    expect(aliceClient.contacts.isDenied(carol.address)).toBe(false)

    expect(conversation.isAllowed).toBe(true)
    expect(conversation.isDenied).toBe(false)
    expect(conversation.consentState).toBe('allowed')
  })

  it('should retrieve consent state', async () => {
    const entries = await bobClient.contacts.refreshConsentList()

    expect(entries.length).toBe(0)

    await bobClient.contacts.deny([alice.address])
    await bobClient.contacts.allow([carol.address])
    await bobClient.contacts.allow([alice.address])
    await bobClient.contacts.deny([carol.address])
    await bobClient.contacts.deny([alice.address])
    await bobClient.contacts.allow([carol.address])

    expect(bobClient.contacts.consentState(alice.address)).toBe('denied')
    expect(bobClient.contacts.isAllowed(alice.address)).toBe(false)
    expect(bobClient.contacts.isDenied(alice.address)).toBe(true)

    expect(bobClient.contacts.consentState(carol.address)).toBe('allowed')
    expect(bobClient.contacts.isAllowed(carol.address)).toBe(true)
    expect(bobClient.contacts.isDenied(carol.address)).toBe(false)

    bobClient = await Client.create(bob, {
      env: 'local',
    })

    expect(bobClient.contacts.consentState(alice.address)).toBe('unknown')
    expect(bobClient.contacts.consentState(carol.address)).toBe('unknown')

    const latestEntries = await bobClient.contacts.refreshConsentList()

    expect(latestEntries.length).toBe(6)
    expect(latestEntries).toEqual([
      {
        entryType: 'address',
        permissionType: 'denied',
        value: alice.address,
      },
      {
        entryType: 'address',
        permissionType: 'allowed',
        value: carol.address,
      },
      {
        entryType: 'address',
        permissionType: 'allowed',
        value: alice.address,
      },
      {
        entryType: 'address',
        permissionType: 'denied',
        value: carol.address,
      },
      {
        entryType: 'address',
        permissionType: 'denied',
        value: alice.address,
      },
      {
        entryType: 'address',
        permissionType: 'allowed',
        value: carol.address,
      },
    ])

    expect(bobClient.contacts.consentState(alice.address)).toBe('denied')
    expect(bobClient.contacts.isAllowed(alice.address)).toBe(false)
    expect(bobClient.contacts.isDenied(alice.address)).toBe(true)

    expect(bobClient.contacts.consentState(carol.address)).toBe('allowed')
    expect(bobClient.contacts.isAllowed(carol.address)).toBe(true)
    expect(bobClient.contacts.isDenied(carol.address)).toBe(false)
  })

  it('should stream consent updates', async () => {
    const aliceStream = await aliceClient.contacts.streamConsentList()
    await aliceClient.conversations.newConversation(bob.address)

    let numActions = 0
    // eslint-disable-next-line no-unreachable-loop
    for await (const action of aliceStream) {
      numActions++
      expect(action.denyAddress).toBeUndefined()
      expect(action.allowAddress?.walletAddresses).toEqual([bob.address])
      break
    }
    expect(numActions).toBe(1)
    await aliceStream.return()
  })

  describe('consent proofs', () => {
    it('handles consent proof on invitation', async () => {
      const bo = await newLocalHostClient()
      const wallet = newWallet()
      const keySigner = new WalletSigner(wallet)
      const alixAddress = await keySigner.wallet.getAddress()
      const alix = await Client.create(wallet, {
        env: 'local',
      })
      const timestamp = Date.now()
      const consentMessage = createConsentMessage(bo.address, timestamp)
      const signedMessage = await keySigner.wallet.signMessage(consentMessage)
      const consentProofPayload = invitation.ConsentProofPayload.fromPartial({
        signature: signedMessage,
        timestamp,
        payloadVersion:
          invitation.ConsentProofPayloadVersion.CONSENT_PROOF_PAYLOAD_VERSION_1,
      })
      const boConvo = await bo.conversations.newConversation(
        alixAddress,
        undefined,
        consentProofPayload
      )
      await alix.contacts.refreshConsentList()
      const conversations = await alix.conversations.list()
      const convo = conversations.find((c) => c.topic === boConvo.topic)
      expect(convo).toBeTruthy()
      const isApproved = await convo?.isAllowed
      expect(isApproved).toBe(true)
    })

    it('consent proof yields to network consent', async () => {
      const bo = await newLocalHostClient()
      const wallet = newWallet()
      const keySigner = new WalletSigner(wallet)
      const alixAddress = await keySigner.wallet.getAddress()
      const alix1 = await Client.create(wallet, {
        env: 'local',
      })
      alix1.contacts.deny([bo.address])
      const alix2 = await Client.create(wallet, {
        env: 'local',
      })
      const timestamp = Date.now()
      const consentMessage = createConsentMessage(bo.address, timestamp)
      const signedMessage = await keySigner.wallet.signMessage(consentMessage)
      const consentProofPayload = invitation.ConsentProofPayload.fromPartial({
        signature: signedMessage,
        timestamp,
        payloadVersion:
          invitation.ConsentProofPayloadVersion.CONSENT_PROOF_PAYLOAD_VERSION_1,
      })
      const boConvo = await bo.conversations.newConversation(
        alixAddress,
        undefined,
        consentProofPayload
      )
      const conversations = await alix2.conversations.list()
      const convo = conversations.find((c) => c.topic === boConvo.topic)
      expect(convo).toBeTruthy()
      await alix2.contacts.refreshConsentList()
      const isDenied = await alix2.contacts.isDenied(bo.address)
      expect(isDenied).toBeTruthy()
    })

    it('consent proof should not approve for invalid signature', async () => {
      const bo = await newLocalHostClient()
      const wallet = newWallet()
      const keySigner = new WalletSigner(wallet)
      const alixAddress = await keySigner.wallet.getAddress()
      const alix = await Client.create(wallet, {
        env: 'local',
      })
      const initialIsAllowed = await alix.contacts.isAllowed(bo.address)
      expect(
        initialIsAllowed,
        'Should be not be allowed by default'
      ).toBeFalsy()
      const timestamp = Date.now()
      const consentMessage = createConsentMessage(bo.address, timestamp)
      const signedMessage = await keySigner.wallet.signMessage(consentMessage)
      const consentProofPayload = invitation.ConsentProofPayload.fromPartial({
        signature: signedMessage,
        timestamp: timestamp + 1000,
        payloadVersion:
          invitation.ConsentProofPayloadVersion.CONSENT_PROOF_PAYLOAD_VERSION_1,
      })
      const boConvo = await bo.conversations.newConversation(
        alixAddress,
        undefined,
        consentProofPayload
      )
      const conversations = await alix.conversations.list()
      const convo = conversations.find((c) => c.topic === boConvo.topic)
      expect(convo).toBeTruthy()
      await alix.contacts.refreshConsentList()
      const isAllowed = await alix.contacts.isAllowed(bo.address)
      expect(isAllowed).toBeFalsy()
    })
  })
})
