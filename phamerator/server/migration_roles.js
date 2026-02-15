
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

Meteor.startup(async () => {
    // Check if migration is needed by looking for users with the old 'roles' field
    // Note: v2 stored roles as { group: [roles] } or [roles]
    // The log showed: {"view":["Actino_Draft"]} -> This means "scope/group" is the key, and "role" is the value?
    // Wait, typically alanning:roles v2 stored it as:
    // { "groupName": ["role1", "role2"] }
    // OR
    // { "__global_roles__": ["admin"] }
    // The log shows: {"view":["Actino_Draft", "Bacillus_Draft", ...]}
    // This implies "view" is the GROUP/SCOPE?
    // User said: "In the old database, info was stored... under roles property."
    // Meteor.publishComposite("genomes") uses Roles.getScopesForUserAsync(userId, "view"). 
    // This suggests "view" is actually the ROLE, and the array are the SCOPES?
    // Let's verify standard alanning:roles storage.
    // v1/v2: user.roles = { group1: [roleA, roleB], group2: [roleA] }
    // OR user.roles = [roleA, roleB] (if no groups).

    // The code behaves as if "view" is the role.
    // Roles.getScopesForUserAsync(userId, "role") -> returns list of scopes.
    // So if user.roles = { "view": ["Actino_Draft"] },
    // Does that mean Group="view", Role="Actino_Draft"?
    // OR Group="Actino_Draft", Role="view"?

    // Let's look at how the app *uses* it:
    // Roles.getScopesForUserAsync(userId, "view")
    // This function (in v3/v4) returns the *scopes* where the user has the "view" role.
    // So "view" IS the role. "Actino_Draft" IS the scope/group.

    // So if legacy data is: {"view": ["Actino_Draft", ...]}
    // It looks like the legacy format was INVERTED compared to standard alanning:roles? 
    // OR, more likely, the legacy app treated "view" as a group?
    // No, standard alanning:roles v1/v2: keys are groups. values are arrays of roles.
    // So {"view": ["Actino_Draft"]} = Group "view" has role "Actino_Draft".
    // BUT the APP Code asks for `getScopesForUser("view")`.
    // If "view" was the group, `getRolesForUser("view")` would return `["Actino_Draft"]`.
    // But `getScopesForUser` is for finding *where* a user has a specific role.

    // Hypothesis: The old app used "view" as a generic container (Group) for dataset names (Roles).
    // BUT the new code (Meteor 3 upgrade) seems to expect "view" to be the ROLE, and datasets to be the SCOPE.
    // This is a semantic inversion.
    // If I migrate, I should align with what the *current code* expects.
    // Current code: `await Roles.getScopesForUserAsync(this.userId, "view")`.
    // This implies: User has role "view" IN scope "Actino_Draft".

    // So, looking at legacy data: `{"view":["Actino_Draft"]}`.
    // This meant: Group="view", Roles=["Actino_Draft"]. 
    // The old app likely checked: `Roles.userIsInRole(user, "Actino_Draft", "view")`.

    // THE MIGRATION TARGET:
    // We want `Roles.getScopesForUserAsync(user, "view")` to return `["Actino_Draft"]`.
    // This requires: User has Role="view" in Scope="Actino_Draft".

    // So, for each key (which seems to be the role name in the new mental model, but was the group in the old data?):
    // Wait, if old data is `{"view": ["dataset1"]}`, that's Group="view", Role="dataset1".
    // If I want Role="view", Scope="dataset1", I need to SWAP them.

    // Let's proceed with this SWAP logic:
    // For each generic-looking key in `user.roles` (like "view", "admin"):
    //   Iterate the list of values (datasets).
    //   Add user to Role=<Key> in Scope=<Value>.

    // EXCEPTION:
    // If attributes are like `{"__global_roles__": ["admin"]}`.
    // Then Role="admin", Scope=null (Global).

    console.log("Starting Role Migration...");

    const users = await Meteor.users.find({ roles: { $exists: true }, 'roles_migrated_v2': { $ne: true } }).fetchAsync();

    if (users.length === 0) {
        console.log("No legacy roles found to migrate.");
        return;
    }

    console.log(`Found ${users.length} users with legacy roles.`);

    for (const user of users) {
        const legacyRoles = user.roles;

        // Handle if it's just an array (global roles, no groups)
        if (Array.isArray(legacyRoles)) {
            // Assume these are global roles
            await Roles.addUsersToRolesAsync(user._id, legacyRoles, null);
            console.log(`Migrated global roles for ${user.username}:`, legacyRoles);
        }
        else if (typeof legacyRoles === 'object') {
            // It's an object: { group: [roles] } ? Or { role: [scopes] } ?
            // Based on observed data `{"view": ["dataset1"]}` and desired outcome (Role="view", Scope="dataset1"):
            // We treat Key as Role, Values as Scopes.

            for (const [key, values] of Object.entries(legacyRoles)) {
                if (key === '__global_roles__') {
                    await Roles.addUsersToRolesAsync(user._id, values, null);
                    console.log(`Migrated global roles for ${user.username}:`, values);
                    continue;
                }

                // For "view": ["dataset1", "dataset2"]
                // We want: Roles.addUsersToRoles(user, "view", "dataset1")

                if (!key || key === 'result' || key === 'undefined' || key === 'null') {
                    console.warn(`Skipping invalid role key: ${key}`);
                    continue;
                }

                // LOGIC UPDATE:
                // Legacy data patterns:
                // 1. "view": ["Dataset1", "Dataset2"] -> Role="view", Scopes=["Dataset1", "Dataset2"]
                // 2. "DatasetName": ["owner", "view"] -> Scope="DatasetName", Roles=["owner", "view"]
                // 3. "GroupName": ["Role1", "Role2"] -> Scope="GroupName", Roles=["Role1", "Role2"]

                let roleName, scopeName;

                // Case 1: "view" is the Role
                if (key === 'view') {
                    roleName = key;
                    // values are scopes
                    if (Array.isArray(values)) {
                        await Roles.createRoleAsync(roleName, { unlessExists: true });
                        for (const scope of values) {
                            try {
                                await Roles.addUsersToRolesAsync(user._id, roleName, scope);
                            } catch (e) {
                                console.error(`Failed to add role ${roleName} in scope ${scope} for ${user.username}`, e);
                            }
                        }
                        console.log(`Migrated role '${roleName}' for ${user.username} in scopes:`, values.length);
                    }
                }
                // Case 2 & 3: Key is the Scope, Values are the Roles
                else {
                    scopeName = key;
                    // values are roles
                    if (Array.isArray(values)) {
                        for (const role of values) {
                            try {
                                // Ensure the role exists
                                await Roles.createRoleAsync(role, { unlessExists: true });
                                await Roles.addUsersToRolesAsync(user._id, role, scopeName);
                            } catch (e) {
                                console.error(`Failed to add role ${role} in scope ${scopeName} for ${user.username}`, e);
                            }
                        }
                        console.log(`Migrated roles for ${user.username} in scope '${scopeName}':`, values);
                    }
                }
            }
        }

        // Mark as migrated with v2 flag to ensure re-run
        await Meteor.users.updateAsync(user._id, { $set: { 'roles_migrated_v2': true } });
    }

    console.log("Role Migration Complete.");
});
