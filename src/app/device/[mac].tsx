import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { userMessage } from '@/api/errors';
import type { BlockList, Host } from '@/api/types';
import { NICKNAME_MAX_LENGTH, validateNickname } from '@/api/validate';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { ListGroup } from '@/components/ListGroup';
import { ListRow } from '@/components/ListRow';
import { EmptyState, LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { SubScreen } from '@/components/SubScreen';
import { useBlockList, useHosts, useSetBlocked } from '@/hooks/router';
import { usePhoneIp } from '@/hooks/usePhoneIp';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { forgetDevice, markKnown, updateDevice, useDevicePrefs } from '@/state/devicePrefs';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, radius, sizes, space } from '@/theme';
import {
  CONNECTION_LABEL,
  DEVICE_KINDS,
  UNKNOWN_NAME,
  deviceIcon,
  deviceTitle,
  hostFromBlocked,
  isKnown,
  isThisPhone,
  paramToMac,
  type DeviceKind,
  type DevicePrefs,
} from '@/utils/devices';
import { formatDuration } from '@/utils/format';
import { isPrivateMac, lookupVendor } from '@/utils/vendor';

const FALLBACK = '/devices';

/** Name + type editor. Keyed by MAC by the parent, so its fields start from the saved values. */
function NameCard({ host, own }: { host: Host; own: DevicePrefs | undefined }) {
  const snackbar = useSnackbar();
  const [name, setName] = useState(own?.nickname ?? '');
  const [kind, setKind] = useState<DeviceKind | undefined>(own?.kind);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const changed = trimmed !== (own?.nickname ?? '') || kind !== own?.kind;

  const save = () => {
    // An empty name is allowed: it goes back to the name the device reports.
    const problem = trimmed ? validateNickname(trimmed) : null;
    if (problem) return setError(problem);
    // Naming a device means the owner recognises it.
    void updateDevice(host.mac, { nickname: trimmed || undefined, kind, known: true }).then(() =>
      snackbar.show('Saved.'),
    );
  };

  return (
    <Card title="Name and type">
      <Input
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder={host.name !== UNKNOWN_NAME ? host.name : 'e.g. Living room TV'}
        maxLength={NICKNAME_MAX_LENGTH}
        autoCapitalize="words"
        returnKeyType="done"
        error={error}
      />
      <ChoiceChips label="Type" choices={DEVICE_KINDS} value={kind} onChange={setKind} />
      <Button label="Save" disabled={!changed} onPress={save} />
      <AppText variant="caption" color={colors.textMuted}>
        Names and types are kept on this phone only. The router isn&apos;t changed.
      </AppText>
    </Card>
  );
}

/**
 * Block / unblock (DESIGN.md §11): confirmation, then fingerprint/PIN, then the router's
 * Wi-Fi MAC filter. Only Wi-Fi devices can be blocked, and never the phone in use.
 */
function AccessCard({
  host,
  title,
  thisPhone,
  blockList,
  failed,
}: {
  host: Host;
  title: string;
  thisPhone: boolean;
  blockList: BlockList | undefined;
  /** The block list couldn't be read (as opposed to still loading). */
  failed: boolean;
}) {
  const snackbar = useSnackbar();
  const setBlocked = useSetBlocked();
  const [confirming, setConfirming] = useState(false);

  const isBlocked = blockList?.mode === 'block' && blockList.blocked.some((b) => b.mac === host.mac);
  // An old list on the router that isn't enforced right now comes back to life with the first block.
  const dormant = blockList?.mode === 'off' ? blockList.blocked.filter((b) => b.mac !== host.mac).length : 0;

  const run = async () => {
    setConfirming(false);
    const auth = await requireDeviceAuth(isBlocked ? 'Confirm unblocking a device' : 'Confirm blocking a device');
    if (auth === 'no_lock') return snackbar.show(NO_LOCK_MESSAGE);
    if (auth !== 'ok') return;
    setBlocked.mutate(
      { mac: host.mac, name: host.name === UNKNOWN_NAME ? '' : host.name, block: !isBlocked },
      {
        onSuccess: (result) =>
          snackbar.show(
            result === 'full'
              ? `The router's block list is full (${blockList?.max ?? 10} devices). Unblock one first.`
              : result === 'allow_list'
                ? "Your router is set to an allow list. Change that on the router's web page first."
                : isBlocked
                  ? `${title} can use your Wi-Fi again.`
                  : `${title} is blocked.`,
          ),
        onError: (e) => snackbar.show(userMessage(e)),
      },
    );
  };

  let note: string | null = null;
  if (thisPhone) note = "This is the phone you're using, so it can't be blocked.";
  else if (host.connection === 'cable') note = "Devices on a cable can't be blocked from here. Unplug the cable instead.";
  else if (!blockList && failed) note = "Couldn't read the router's block list. Go back and pull down to try again.";
  else if (blockList?.mode === 'allow') {
    note = "Your router only lets listed devices connect (allow list). Manage that on the router's web page.";
  }

  return (
    <Card title="Wi-Fi access">
      {note ? (
        <AppText variant="body" color={colors.textSecondary}>
          {note}
        </AppText>
      ) : !blockList ? (
        <Skeleton height={sizes.touchTarget} />
      ) : isBlocked ? (
        <>
          <AppText variant="body" color={colors.textSecondary}>
            This device is blocked. It can&apos;t connect to your Wi-Fi until you unblock it.
          </AppText>
          <Button
            label="Unblock"
            variant="secondary"
            icon="lock-open-outline"
            loading={setBlocked.isPending}
            loadingLabel="Unblocking…"
            onPress={() => setConfirming(true)}
          />
        </>
      ) : (
        <>
          <AppText variant="body" color={colors.textSecondary}>
            Blocking disconnects this device and stops it from joining your Wi-Fi again, even with the right password.
          </AppText>
          <Button
            label="Block this device"
            variant="danger"
            icon="ban-outline"
            loading={setBlocked.isPending}
            loadingLabel="Blocking…"
            onPress={() => setConfirming(true)}
          />
        </>
      )}
      <ConfirmDialog
        visible={confirming}
        title={isBlocked ? `Unblock ${title}?` : `Block ${title}?`}
        message={
          isBlocked
            ? 'It will be able to connect to your Wi-Fi again.'
            : `It will be disconnected and can't use your Wi-Fi until you unblock it.${
                dormant > 0
                  ? ` This also blocks ${dormant === 1 ? '1 other device' : `${dormant} other devices`} already on the router's block list.`
                  : ''
              }`
        }
        confirmLabel={isBlocked ? 'Unblock' : 'Block'}
        destructive={!isBlocked}
        onConfirm={() => void run()}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}

export default function DeviceScreen() {
  const mac = paramToMac(useLocalSearchParams<{ mac: string }>().mac);
  const focused = useScreenFocus();
  const { status } = useAuth();
  const hosts = useHosts(focused);
  const blockList = useBlockList(focused);
  const phoneIp = usePhoneIp();
  const { prefs, loaded } = useDevicePrefs();
  const snackbar = useSnackbar();

  if (status !== 'logged_in') {
    return (
      <SubScreen title="Device" fallback={FALLBACK}>
        <Card>
          <LoginRequired message="Log in to see this device." />
        </Card>
      </SubScreen>
    );
  }

  // A blocked device can be missing from the router's host list; show it from the block list.
  const listed = blockList.data?.blocked.find((b) => b.mac === mac);
  const host = mac
    ? (hosts.data?.find((h) => h.mac === mac) ?? (hosts.data && listed ? hostFromBlocked(listed.mac, listed.name) : undefined))
    : undefined;

  if (!host || !loaded) {
    const waiting = !!mac && (!hosts.data || !loaded) && !hosts.isError;
    return (
      <SubScreen title="Device" fallback={FALLBACK}>
        <Card>
          {waiting ? (
            <>
              <Skeleton height={56} />
              <Skeleton width="70%" />
              <Skeleton width="85%" />
            </>
          ) : hosts.isError && !hosts.data ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load this device"
              message="Check that your phone is on the router's Wi-Fi."
              actionLabel="Retry"
              onAction={() => void hosts.refetch()}
            />
          ) : (
            <EmptyState
              icon="help-circle-outline"
              title="Device not found"
              message="It's no longer in your router's list."
            />
          )}
        </Card>
      </SubScreen>
    );
  }

  const own = prefs[host.mac];
  const thisPhone = isThisPhone(host, phoneIp);
  const known = isKnown(host, own, thisPhone);
  const vendor = lookupVendor(host.mac);
  const privateMac = isPrivateMac(host.mac);
  const title = deviceTitle(host, own);
  const blocked = blockList.data?.mode === 'block' && !!listed;

  return (
    <SubScreen title="Device" fallback={FALLBACK}>
      <Card>
        <View style={styles.identity}>
          <View style={[styles.tile, !host.active && styles.tileMuted]}>
            <Ionicons
              name={deviceIcon(host, own, thisPhone)}
              size={sizes.icon + space.xs}
              color={host.active ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.names}>
            <AppText variant="heading" numberOfLines={2}>
              {title}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {[vendor, host.name !== UNKNOWN_NAME && host.name !== title ? host.name : null]
                .filter(Boolean)
                .join(' · ') || (privateMac ? 'Private Wi-Fi address' : 'Maker unknown')}
            </AppText>
          </View>
        </View>
        <View style={styles.chips}>
          {blocked ? (
            <StatusChip tone="danger" label="Blocked" />
          ) : (
            <StatusChip tone={host.active ? 'success' : 'neutral'} label={host.active ? 'Connected' : 'Not connected'} />
          )}
          {thisPhone && <StatusChip tone="primary" label="This phone" dot={false} />}
          {!known && !blocked && <StatusChip tone="warning" label="New" dot={false} />}
        </View>
      </Card>

      {!known && !blocked && (
        <Card title="Do you recognise this device?">
          <AppText variant="body" color={colors.textSecondary}>
            It&apos;s using your network but isn&apos;t marked as known. If it isn&apos;t yours, block it below, or
            change your Wi-Fi password so every device has to enter the new one.
          </AppText>
          <Button
            label="Yes, it's mine"
            icon="checkmark-circle-outline"
            onPress={() => void markKnown([host.mac]).then(() => snackbar.show('Marked as known.'))}
          />
          <Button label="Change Wi-Fi password" variant="secondary" icon="key-outline" onPress={() => router.push('/wifi')} />
        </Card>
      )}

      {/* Re-created when the saved values change (after Save or Forget), so the fields follow them. */}
      <NameCard key={`${host.mac}|${own?.nickname ?? ''}|${own?.kind ?? ''}`} host={host} own={own} />

      <ListGroup title="Details">
        <ListRow
          title="Status"
          value={
            !host.active
              ? 'Not connected'
              : host.connectedSeconds > 0
                ? `Connected for ${formatDuration(host.connectedSeconds)}`
                : 'Connected'
          }
        />
        <ListRow
          title="Connection"
          value={host.connection === 'unknown' ? (host.active ? 'Connected' : '–') : CONNECTION_LABEL[host.connection]}
          divider
        />
        {host.band ? <ListRow title="Wi-Fi band" value={host.band} divider /> : null}
        <ListRow title="IP address" value={host.ip || '–'} divider />
        {host.addressSource ? (
          <ListRow
            title="IP address type"
            value={host.addressSource === 'automatic' ? 'Automatic' : 'Fixed on the device'}
            divider
          />
        ) : null}
        <ListRow title="MAC address" value={host.mac} divider />
        <ListRow title="Maker" value={vendor ?? (privateMac ? 'Hidden' : 'Unknown')} divider />
        <ListRow title="Name on router" value={host.name} divider />
      </ListGroup>
      {privateMac && (
        <AppText variant="caption" color={colors.textMuted}>
          This device uses a private (random) Wi-Fi address, so its maker can&apos;t be identified. It may show up as a
          new device again if it changes that address.
        </AppText>
      )}

      <AccessCard
        host={host}
        title={title}
        thisPhone={thisPhone}
        blockList={blockList.data}
        failed={blockList.isError}
      />

      {own && !thisPhone && (
        <>
          <Button
            label="Forget this device"
            variant="secondary"
            icon="refresh-outline"
            onPress={() => void forgetDevice(host.mac).then(() => snackbar.show('Device forgotten.'))}
          />
          <AppText variant="caption" color={colors.textMuted}>
            Removes the name and type you gave it and marks it as new again. The device stays connected.
          </AppText>
        </>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: {
    width: sizes.listRow,
    height: sizes.listRow,
    borderRadius: radius.card,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMuted: { backgroundColor: colors.surfaceMuted },
  names: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
