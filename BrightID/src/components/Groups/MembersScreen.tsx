import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  FlatList,
  TouchableOpacity,
  Text,
} from 'react-native';
import moment from 'moment';
import { useDispatch, useSelector } from '@/store';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { innerJoin } from 'ramda';
import { useTranslation } from 'react-i18next';
import api from '@/api/brightId';
import {
  leaveGroup,
  dismissFromGroup,
  addAdmin,
  selectAllConnections,
} from '@/actions';
import EmptyList from '@/components/Helpers/EmptyList';
import { ORANGE, WHITE, BLUE, DARK_GREY, BLACK } from '@/theme/colors';
import Material from 'react-native-vector-icons/MaterialCommunityIcons';
import { DEVICE_LARGE } from '@/utils/deviceConstants';
import { fontSize } from '@/theme/fonts';
import MemberCard from './MemberCard';
import GroupPhoto from './GroupPhoto';

type MembersRoute = RouteProp<{ Members: { group: Group } }, 'Members'>;

function MembersScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute<MembersRoute>();

  const connections = useSelector(selectAllConnections);
  const user = useSelector((state) => state.user);

  const { group } = route.params;
  const { id: groupID, admins = [], members = [] } = group;

  const [contextActions, setContextActions] = useState([]);
  const { t } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();

  const ACTION_INVITE = t('groups.groupActionSheet.inviteUser');
  const ACTION_LEAVE = t('groups.groupActionSheet.leaveGroup');
  // Not using 'common.actionSheet.cancel' because 'Cancel' instead of 'cancel' (making sure printed text doesn't change after i18n)
  const ACTION_CANCEL = t('groups.groupActionSheet.cancel');

  // set up top right button in header
  useLayoutEffect(() => {
    if (contextActions.length > 0) {
      // action sheet actions
      const handleLeaveGroup = () => {
        const buttons = [
          {
            text: t('common.alert.cancel'),
            style: 'cancel',
          },
          {
            text: t('common.alert.ok'),
            onPress: async () => {
              try {
                await api.leaveGroup(groupID);
                await dispatch(leaveGroup(group));
                navigation.goBack();
              } catch (err) {
                Alert.alert(
                  t('groups.alert.title.errorLeaveGroup'),
                  err.message,
                );
              }
            },
          },
        ];
        Alert.alert(
          t('groups.alert.title.leaveGroup'),
          t('groups.alert.text.leaveGroup'),
          // @ts-ignore
          buttons,
          {
            cancelable: true,
          },
        );
      };

      const handleInvite = () => {
        navigation.navigate('InviteList', {
          group,
        });
      };

      const performAction = (index) => {
        const action = contextActions[index];
        console.log(`Performing action ${action}`);
        switch (action) {
          case ACTION_INVITE:
            handleInvite();
            break;
          case ACTION_LEAVE:
            handleLeaveGroup();
            break;
          case ACTION_CANCEL:
          default:
          // do nothing
        }
      };

      // navigation.setOptions({
      //   headerRight: () => (
      //     <TouchableOpacity
      //       testID="groupOptionsBtn"
      //       style={{ marginRight: 11 }}
      //       onPress={() => {
      //         showActionSheetWithOptions(
      //           {
      //             options: contextActions,
      //             cancelButtonIndex: contextActions.indexOf(ACTION_CANCEL),
      //             destructiveButtonIndex: contextActions.indexOf(ACTION_LEAVE),
      //             title: t('common.actionSheet.title'),
      //             showSeparators: true,
      //             textStyle: {
      //               color: BLUE,
      //               textAlign: 'center',
      //               width: '100%',
      //             },
      //             titleTextStyle: {
      //               textAlign: 'center',
      //               width: '100%',
      //             },
      //           },
      //           performAction,
      //         );
      //       }}
      //     >
      //       <Material name="dots-horizontal" size={32} color={WHITE} />
      //     </TouchableOpacity>
      //   ),
      // });
    }
  }, [
    navigation,
    contextActions,
    showActionSheetWithOptions,
    dispatch,
    group,
    groupID,
    t,
    ACTION_LEAVE,
    ACTION_CANCEL,
    ACTION_INVITE,
  ]);

  // set available actions for group
  useEffect(() => {
    const actions = [];
    if (admins.includes(user.id)) {
      // admins can invite other members to group
      actions.push(ACTION_INVITE);
    }
    if (members.includes(user.id)) {
      // existing member can leave group
      actions.push(ACTION_LEAVE);
    }
    if (actions.length > 0) {
      actions.push(ACTION_CANCEL);
    }
    setContextActions(actions);
  }, [user.id, admins, members, ACTION_INVITE, ACTION_LEAVE, ACTION_CANCEL]);

  // Only include the group members that user knows (is connected with), and the user itself
  const groupMembers = useMemo(() => {
    // TODO: userObj is ugly and just here to satisfy flow typecheck for 'connection' type.
    //    Define a dedicated type for group member to use here or somehow merge user and connection types.
    const userobj = {
      id: user.id,
      name: user.name,
      photo: user.photo,
      score: user.score,
      aesKey: '',
      connectionDate: 0,
      status: '',
      signingKey: '',
      createdAt: 0,
      hasPrimaryGroup: false,
    };
    return [userobj].concat(
      innerJoin(
        (connection, member) => connection.id === member,
        connections,
        members,
      ),
    );
  }, [user, connections, members]);

  const handleDismiss = (user) => {
    const buttons = [
      {
        text: t('common.alert.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.alert.ok'),
        onPress: async () => {
          try {
            await api.dismiss(user.id, groupID);
            dispatch(dismissFromGroup({ member: user.id, group }));
          } catch (err) {
            Alert.alert(
              t('groups.alert.title.errorDismissMember'),
              err.message,
            );
          }
        },
      },
    ];
    Alert.alert(
      t('groups.alert.title.dismissMember'),
      t('groups.alert.text.dismissMember', { name: user.name }),
      // @ts-ignore
      buttons,
      {
        cancelable: true,
      },
    );
  };

  const handleAddAdmin = (user) => {
    const buttons = [
      {
        text: t('common.alert.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.alert.ok'),
        onPress: async () => {
          try {
            await api.addAdmin(user.id, groupID);
            dispatch(addAdmin({ member: user.id, group }));
          } catch (err) {
            Alert.alert(
              t('groups.alert.text.addAdmin', { name: user.name }),
              err.message,
            );
          }
        },
      },
    ];
    Alert.alert(
      t('groups.alert.title.addAdmin'),
      t('groups.alert.text.addAdmin', { name: user.name }),
      // @ts-ignore
      buttons,
      {
        cancelable: true,
      },
    );
  };

  const GroupHeader = () => (
    <View style={styles.header}>
      <View style={styles.profile}>
        <View style={styles.photoContainer}>
          <GroupPhoto group={group} large={true} />
        </View>
        <View style={styles.nameContainer}>
          <View style={styles.nameLabel}>
            <Text style={styles.name} numberOfLines={1}>
              {group.name}
            </Text>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.connectionInfo}>
            <Text style={styles.connectionTimestampText}>
              {t('groups.tag.joinedDate', {
                date: `${moment(parseInt(String(group.joined), 10)).fromNow()}`,
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderMember = ({ item, index }) => {
    const memberIsAdmin = admins.includes(item.id);
    const userIsAdmin = admins.includes(user.id);
    return (
      <MemberCard
        testID={`memberItem-${index}`}
        connectionDate={item.connectionDate}
        flaggers={item.flaggers}
        memberId={item.id}
        name={item.name}
        photo={item.photo}
        memberIsAdmin={memberIsAdmin}
        userIsAdmin={userIsAdmin}
        userId={user.id}
        handleDismiss={handleDismiss}
        handleAddAdmin={handleAddAdmin}
      />
    );
  };

  return (
    <>
      <View style={styles.orangeTop} />
      <View style={styles.container}>
        <GroupHeader />

        <View testID="membersView" style={styles.mainContainer}>
          <View>
            <FlatList
              style={styles.membersContainer}
              data={groupMembers}
              keyExtractor={({ id }, index) => id + index}
              renderItem={renderMember}
              contentContainerStyle={{ paddingBottom: 50, flexGrow: 1 }}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <EmptyList title={t('groups.text.noMembers')} />
              }
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  orangeTop: {
    backgroundColor: ORANGE,
    height: DEVICE_LARGE ? 70 : 65,
    width: '100%',
    zIndex: 1,
  },
  membersContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: WHITE,
    borderTopRightRadius: 58,
    marginTop: -58,
    zIndex: 10,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: DEVICE_LARGE ? 22 : 18,
    marginBottom: DEVICE_LARGE ? 40 : 36,
  },
  mainContainer: {
    flexGrow: 1,
    backgroundColor: WHITE,
    alignItems: 'center',
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop: 8,
  },
  connectionTimestampText: {
    fontFamily: 'Poppins-Medium',
    fontSize: fontSize[10],
    color: ORANGE,
    marginHorizontal: 2,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  photoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  profilePhoto: {
    borderRadius: DEVICE_LARGE ? 45 : 39,
    width: DEVICE_LARGE ? 90 : 78,
    height: DEVICE_LARGE ? 90 : 78,
  },
  nameContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '60%',
    marginLeft: DEVICE_LARGE ? 22 : 20,
  },
  nameLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontFamily: 'Poppins-Medium',
    fontSize: fontSize[17],
    color: BLACK,
  },
  connectionInfo: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDivider: {
    borderBottomWidth: 2,
    borderBottomColor: ORANGE,
    paddingBottom: 3,
    width: '100%',
  },
  verificationSticker: {
    marginTop: 8,
  },
});

export default MembersScreen;
